import dotenv from 'dotenv';
import path from 'path';
import { db } from './db/database.ts';
import { runWorkerCycle } from './worker.ts';
import { persistentScheduler } from './scheduler/persistentScheduler.ts';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

async function runCronJob() {
  console.log('=================================================');
  console.log('⏰ RENDER CRON JOB SCHEDULED WORKER TRIGGER');
  console.log('=================================================');

  const idempotencyKey = `cron_${new Date().toISOString().substring(0, 13)}`; // Hourly key
  const job = persistentScheduler.createJob('CRON_RECONCILE', idempotencyKey);
  const lock = persistentScheduler.acquireLock(job.jobId, 'render_cron_runner');

  if (!lock.acquired) {
    console.log(`[CRON] Lock not acquired: ${lock.reason}. Exiting gracefully.`);
    process.exit(0);
  }

  try {
    await runWorkerCycle();
    persistentScheduler.releaseLockSuccess(job.jobId);
    console.log('🎉 Cron scheduled cycle completed successfully!');
    process.exit(0);
  } catch (err: any) {
    persistentScheduler.releaseLockFailure(job.jobId, err.message);
    console.error('❌ Cron scheduled cycle error:', err.message);
    process.exit(1);
  }
}

runCronJob().catch(err => {
  console.error('Fatal cron error:', err);
  process.exit(1);
});
