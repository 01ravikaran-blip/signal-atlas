import dotenv from 'dotenv';
import path from 'path';
import { db } from './db/database.ts';
import { llmProvider } from './ai/llmProvider.ts';
import { runAutonomousPublishingCycle } from './scheduler/daemon.ts';
import { runEngagementCycle } from './scheduler/engagementDaemon.ts';
import { persistentScheduler } from './scheduler/persistentScheduler.ts';
import { validateDatabaseConnection } from './db/dbAdapter.ts';
import { WorkerHeartbeat } from './types.js';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const WORKER_ID = process.env.WORKER_ID || `worker_${process.pid}_${Math.random().toString(36).substr(2, 4)}`;

let isRunning = false;
let lastIngestionTime: string | undefined = undefined;
let lastAiGenerationTime: string | undefined = undefined;
let lastPublicationTime: string | undefined = undefined;
let failedJobsCount = 0;
let pendingJobsCount = 0;
let lastError: string | undefined = undefined;

async function updateHeartbeat(status: WorkerHeartbeat['status']) {
  const aiStatus = llmProvider.getStatus();
  const heartbeat: WorkerHeartbeat = {
    id: 'hb_' + WORKER_ID,
    workerId: WORKER_ID,
    status,
    lastHeartbeat: new Date().toISOString(),
    lastSuccessfulIngestion: lastIngestionTime,
    lastSuccessfulAiGeneration: lastAiGenerationTime,
    lastSuccessfulPublication: lastPublicationTime,
    nextScheduledRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    pendingJobsCount,
    failedJobsCount,
    lastError,
    mode: aiStatus.provider
  };
  db.updateWorkerHeartbeat(heartbeat);
}

export async function runWorkerCycle() {
  if (isRunning) return;
  isRunning = true;

  try {
    await updateHeartbeat('BUSY');

    // 1. Recover any stale locks from previous crashes
    persistentScheduler.recoverInterruptedJobs();

    // 2. Run Autonomous Ingestion & Publishing Cycle
    const cycleResult = await runAutonomousPublishingCycle();
    lastIngestionTime = new Date().toISOString();

    if (cycleResult.status === 'PUBLISHED_SUCCESS') {
      lastAiGenerationTime = new Date().toISOString();
      lastPublicationTime = new Date().toISOString();
    } else if (cycleResult.status === 'ERROR') {
      failedJobsCount++;
      lastError = cycleResult.blockedReason || 'Publishing cycle error';
    }

    // 3. Run Autonomous Engagement Cycle (Notifications, Replies, Likes)
    try {
      await runEngagementCycle();
    } catch (engErr: any) {
      db.addLog('WARN', 'WORKER', `Engagement cycle warning: ${engErr.message}`);
    }

    await updateHeartbeat('ONLINE');
  } catch (err: any) {
    failedJobsCount++;
    lastError = err.message;
    db.addLog('ERROR', 'WORKER', `Worker cycle error: ${err.message}`);
    await updateHeartbeat('STALE');
  } finally {
    isRunning = false;
  }
}

async function startWorker() {
  console.log(`=================================================`);
  console.log(`⚡ SIGNAL ATLAS PERSISTENT BACKGROUND WORKER ONLINE`);
  console.log(`🆔 Worker ID: ${WORKER_ID}`);
  console.log(`=================================================`);

  // Log AI & DB Startup status
  llmProvider.logStartupStatus();
  const dbStatus = await validateDatabaseConnection();
  db.addLog('INFO', 'WORKER', `Database status: type=${dbStatus.type}, connected=${dbStatus.connected}, persistent=${dbStatus.persistent}`);

  // Run initial cycle
  await runWorkerCycle();

  // Recurring 5-minute worker cycle
  const intervalMs = (parseInt(process.env.PUBLISH_INTERVAL_MINUTES || '5', 10)) * 60 * 1000;
  setInterval(() => {
    runWorkerCycle().catch(err => console.error('Worker recurring cycle error:', err));
  }, intervalMs);
}

import { fileURLToPath } from 'url';

// Run worker if called directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startWorker().catch(err => console.error('Fatal worker error:', err));
}
