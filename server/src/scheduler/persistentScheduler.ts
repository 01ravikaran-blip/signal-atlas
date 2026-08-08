import { db } from '../db/database.ts';
import { SchedulerJob } from '../types.js';

export interface LockAcquisitionResult {
  acquired: boolean;
  job?: SchedulerJob;
  reason?: string;
}

export class PersistentScheduler {
  public createJob(
    jobType: SchedulerJob['jobType'],
    idempotencyKey: string,
    scheduledTime = new Date().toISOString()
  ): SchedulerJob {
    const existing = db.getSchedulerJobs(100).find(j => j.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing;
    }

    const job: SchedulerJob = {
      jobId: 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      jobType,
      scheduledTime,
      status: 'PENDING',
      attemptNumber: 0,
      idempotencyKey
    };

    db.saveSchedulerJob(job);
    return job;
  }

  public acquireLock(jobId: string, workerId: string): LockAcquisitionResult {
    const job = db.getSchedulerJob(jobId);
    if (!job) {
      return { acquired: false, reason: `Job ${jobId} not found.` };
    }

    const now = new Date();

    // Check if locked by another active process (lock expires after 5 minutes)
    if (job.status === 'RUNNING' && job.lockedBy && job.lockedAt) {
      const lockAgeMs = now.getTime() - new Date(job.lockedAt).getTime();
      if (lockAgeMs < 5 * 60 * 1000) {
        return { acquired: false, reason: `Job ${jobId} is currently locked by worker ${job.lockedBy}.` };
      }
    }

    if (job.status === 'COMPLETED') {
      return { acquired: false, reason: `Job ${jobId} already completed.` };
    }

    // Acquire lock
    job.status = 'RUNNING';
    job.lockedBy = workerId;
    job.lockedAt = now.toISOString();
    job.startedTime = now.toISOString();
    job.attemptNumber += 1;

    db.saveSchedulerJob(job);
    db.addLog('INFO', 'PERSISTENT_SCHEDULER', `Worker ${workerId} acquired lock for job ${jobId} (attempt ${job.attemptNumber}).`);

    return { acquired: true, job };
  }

  public releaseLockSuccess(jobId: string, publishedContentIds?: string[], providerResponseIds?: string[]): void {
    const job = db.getSchedulerJob(jobId);
    if (!job) return;

    job.status = 'COMPLETED';
    job.completedTime = new Date().toISOString();
    job.lockedBy = undefined;
    job.lockedAt = undefined;
    if (publishedContentIds) job.publishedContentIds = publishedContentIds;
    if (providerResponseIds) job.providerResponseIds = providerResponseIds;

    db.saveSchedulerJob(job);
    db.addLog('SUCCESS', 'PERSISTENT_SCHEDULER', `Job ${jobId} completed successfully.`);
  }

  public releaseLockFailure(jobId: string, error: string, isAiOutage = false): void {
    const job = db.getSchedulerJob(jobId);
    if (!job) return;

    job.lastError = error;
    job.lockedBy = undefined;
    job.lockedAt = undefined;

    if (isAiOutage) {
      job.status = 'PENDING_AI';
      job.nextRetry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      db.saveSchedulerJob(job);
      db.addLog('WARN', 'PERSISTENT_SCHEDULER', `Job ${jobId} set to PENDING_AI status due to AI provider outage.`);
      return;
    }

    if (job.attemptNumber >= 5) {
      job.status = 'DEAD_LETTER';
      db.saveSchedulerJob(job);
      db.addLog('ERROR', 'PERSISTENT_SCHEDULER', `Job ${jobId} reached max attempts (${job.attemptNumber}); moved to DEAD_LETTER.`);
      return;
    }

    // Exponential backoff: 2^attempt * 60 sec
    const backoffMs = Math.pow(2, job.attemptNumber) * 60 * 1000;
    job.status = 'PENDING';
    job.nextRetry = new Date(Date.now() + backoffMs).toISOString();

    db.saveSchedulerJob(job);
    db.addLog('WARN', 'PERSISTENT_SCHEDULER', `Job ${jobId} failed (attempt ${job.attemptNumber}). Next retry at ${job.nextRetry}.`);
  }

  public recoverInterruptedJobs(): number {
    const jobs = db.getSchedulerJobs(100);
    let recoveredCount = 0;
    const nowMs = Date.now();

    for (const job of jobs) {
      if (job.status === 'RUNNING' && job.lockedAt) {
        const lockAgeMs = nowMs - new Date(job.lockedAt).getTime();
        if (lockAgeMs > 5 * 60 * 1000) {
          job.status = 'PENDING';
          job.lockedBy = undefined;
          job.lockedAt = undefined;
          db.saveSchedulerJob(job);
          recoveredCount++;
        }
      }
    }

    if (recoveredCount > 0) {
      db.addLog('WARN', 'PERSISTENT_SCHEDULER', `Recovered ${recoveredCount} interrupted/stale job locks.`);
    }

    return recoveredCount;
  }
}

export const persistentScheduler = new PersistentScheduler();
