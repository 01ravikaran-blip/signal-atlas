import { Router, Request, Response } from 'express';
import { db } from '../db/database.ts';
import { llmProvider } from '../ai/llmProvider.ts';
import { validateDatabaseConnection } from '../db/dbAdapter.ts';
import { getPermissionStatusReport } from '../services/engagementEngine.ts';

export const healthRouter = Router();

// GET /health - Basic Liveness
healthRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'signal-atlas',
    version: '1.0.0',
    environment: process.env.NODE_ENV || (process.env.RENDER ? 'production' : 'development'),
    timestamp: new Date().toISOString()
  });
});

// GET /health/readiness - Complete Component Readiness Check
healthRouter.get('/health/readiness', async (req: Request, res: Response) => {
  const dbStatus = await validateDatabaseConnection();
  const aiStatus = await llmProvider.checkReachability();
  const heartbeat = db.getLatestWorkerHeartbeat();
  const permissions = getPermissionStatusReport();

  const isWorkerRecent = heartbeat ? (Date.now() - new Date(heartbeat.lastHeartbeat).getTime()) < 15 * 60 * 1000 : false;

  const isReady = dbStatus.connected && aiStatus.reachability === 'reachable';

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus.connected,
      type: dbStatus.type,
      persistent: dbStatus.persistent
    },
    aiProvider: {
      provider: aiStatus.provider,
      model: aiStatus.model,
      reachability: aiStatus.reachability
    },
    worker: {
      online: isWorkerRecent,
      lastHeartbeat: heartbeat?.lastHeartbeat || null
    },
    platformIntegrations: {
      bluesky: permissions.BLUESKY.configured,
      farcaster: permissions.FARCASTER.configured,
      discord: permissions.DISCORD.configured,
      telegram: permissions.TELEGRAM.configured
    }
  });
});

// GET /health/worker - Background Worker Status
healthRouter.get('/health/worker', (req: Request, res: Response) => {
  const heartbeat = db.getLatestWorkerHeartbeat();
  const pendingJobs = db.getPendingSchedulerJobs();
  const recentJobs = db.getSchedulerJobs(10);

  const lockState = recentJobs.find(j => j.status === 'RUNNING');

  res.json({
    workerId: heartbeat?.workerId || 'none',
    status: heartbeat?.status || 'OFFLINE',
    lastHeartbeat: heartbeat?.lastHeartbeat || null,
    lastSuccessfulIngestion: heartbeat?.lastSuccessfulIngestion || null,
    lastSuccessfulAiGeneration: heartbeat?.lastSuccessfulAiGeneration || null,
    lastSuccessfulPublication: heartbeat?.lastSuccessfulPublication || null,
    nextScheduledRun: heartbeat?.nextScheduledRun || null,
    pendingJobsCount: pendingJobs.length,
    failedJobsCount: heartbeat?.failedJobsCount || 0,
    currentLock: lockState ? { jobId: lockState.jobId, lockedBy: lockState.lockedBy, lockedAt: lockState.lockedAt } : null
  });
});

// GET /health/ai - AI Engine Diagnostics
healthRouter.get('/health/ai', async (req: Request, res: Response) => {
  const aiStatus = await llmProvider.checkReachability();
  res.json({
    provider: aiStatus.provider,
    model: aiStatus.model,
    reachability: aiStatus.reachability,
    fallbackEnabled: aiStatus.fallbackEnabled,
    lastLatencyMs: aiStatus.lastLatencyMs || null,
    error: aiStatus.lastError ? aiStatus.lastError.replace(/bearer\s+[a-z0-9_-]+/gi, '[REDACTED]') : null
  });
});
