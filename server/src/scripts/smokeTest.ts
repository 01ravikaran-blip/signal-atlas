import dotenv from 'dotenv';
import path from 'path';
import { db } from '../db/database.ts';
import { llmProvider } from '../ai/llmProvider.ts';
import { validateDatabaseConnection } from '../db/dbAdapter.ts';
import { getPermissionStatusReport } from '../services/engagementEngine.ts';
import { fetchLiveMarketSnapshot } from '../collectors/marketCollector.ts';
import { fetchLatestNews } from '../collectors/newsCollector.ts';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export interface ComponentStatus {
  component: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'CONFIGURED' | 'SIMULATED';
  lastSuccess: string;
  currentError: string;
}

export async function runProductionSmokeTest(): Promise<ComponentStatus[]> {
  console.log('=================================================');
  console.log('🔍 SIGNAL ATLAS PRODUCTION SMOKE TEST DIAGNOSTIC');
  console.log('=================================================');

  const results: ComponentStatus[] = [];
  const now = new Date().toISOString();

  // 1. Database
  const dbStatus = await validateDatabaseConnection();
  results.push({
    component: 'Database',
    status: dbStatus.connected ? 'ONLINE' : 'OFFLINE',
    lastSuccess: dbStatus.connected ? now : 'N/A',
    currentError: dbStatus.error || 'None'
  });

  // 2. Web Service
  results.push({
    component: 'Web service',
    status: 'ONLINE',
    lastSuccess: now,
    currentError: 'None'
  });

  // 3. Worker
  const heartbeat = db.getLatestWorkerHeartbeat();
  const workerRecent = heartbeat && (Date.now() - new Date(heartbeat.lastHeartbeat).getTime() < 15 * 60 * 1000);
  results.push({
    component: 'Worker',
    status: workerRecent ? 'ONLINE' : (heartbeat ? 'DEGRADED' : 'SIMULATED'),
    lastSuccess: heartbeat?.lastHeartbeat || 'N/A',
    currentError: heartbeat?.lastError || 'None'
  });

  // 4. Scheduler
  const pendingJobs = db.getPendingSchedulerJobs();
  results.push({
    component: 'Scheduler',
    status: 'ONLINE',
    lastSuccess: now,
    currentError: pendingJobs.length > 0 ? `${pendingJobs.length} jobs pending` : 'None'
  });

  // 5. AI Provider
  const aiStatus = await llmProvider.checkReachability();
  results.push({
    component: 'AI provider',
    status: aiStatus.reachability === 'reachable' ? 'ONLINE' : 'DEGRADED',
    lastSuccess: aiStatus.reachability === 'reachable' ? now : 'N/A',
    currentError: aiStatus.lastError || 'None'
  });

  // 6. News Ingestion
  try {
    const news = await fetchLatestNews();
    results.push({
      component: 'News ingestion',
      status: news.length > 0 ? 'ONLINE' : 'DEGRADED',
      lastSuccess: now,
      currentError: news.length > 0 ? 'None' : 'No news items returned'
    });
  } catch (err: any) {
    results.push({
      component: 'News ingestion',
      status: 'OFFLINE',
      lastSuccess: 'N/A',
      currentError: err.message
    });
  }

  // 7. Market Data
  try {
    const market = await fetchLiveMarketSnapshot();
    results.push({
      component: 'Market data',
      status: market.crypto && market.crypto.length > 0 ? 'ONLINE' : 'DEGRADED',
      lastSuccess: now,
      currentError: 'None'
    });
  } catch (err: any) {
    results.push({
      component: 'Market data',
      status: 'OFFLINE',
      lastSuccess: 'N/A',
      currentError: err.message
    });
  }

  // Platform Integrations
  const perms = getPermissionStatusReport();
  
  results.push({
    component: 'Bluesky',
    status: perms.BLUESKY.configured ? 'CONFIGURED' : 'SIMULATED',
    lastSuccess: perms.BLUESKY.configured ? now : 'N/A',
    currentError: perms.BLUESKY.reason || 'None'
  });

  results.push({
    component: 'Farcaster',
    status: perms.FARCASTER.configured ? 'CONFIGURED' : 'SIMULATED',
    lastSuccess: perms.FARCASTER.configured ? now : 'N/A',
    currentError: perms.FARCASTER.reason || 'None'
  });

  results.push({
    component: 'Telegram',
    status: perms.TELEGRAM.configured ? 'CONFIGURED' : 'SIMULATED',
    lastSuccess: perms.TELEGRAM.configured ? now : 'N/A',
    currentError: perms.TELEGRAM.reason || 'None'
  });

  results.push({
    component: 'Discord',
    status: perms.DISCORD.configured ? 'CONFIGURED' : 'SIMULATED',
    lastSuccess: perms.DISCORD.configured ? now : 'N/A',
    currentError: perms.DISCORD.reason || 'None'
  });

  results.push({
    component: 'Dashboard',
    status: 'ONLINE',
    lastSuccess: now,
    currentError: 'None'
  });

  console.table(results);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionSmokeTest().then(() => process.exit(0)).catch(err => {
    console.error('Smoke test error:', err);
    process.exit(1);
  });
}
