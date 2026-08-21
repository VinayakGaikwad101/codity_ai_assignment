import { prisma } from '../lib/prisma.js';
import { JobStatus, WorkerStatus, LogLevel } from '@scheduler/shared';

export class ReaperDaemon {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private intervalMs: number,
    private staleThresholdMs: number
  ) {}

  start(): void {
    this.timer = setInterval(async () => {
      await this.reapDeadWorkersAndJobs();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async reapDeadWorkersAndJobs(): Promise<void> {
    try {
      const staleCutoff = new Date(Date.now() - this.staleThresholdMs);

      // 1. Detect dead workers
      const deadWorkers = await prisma.worker.findMany({
        where: {
          status: { in: [WorkerStatus.HEALTHY, WorkerStatus.STALE] },
          lastHeartbeatAt: { lt: staleCutoff },
        },
      });

      if (deadWorkers.length === 0) return;

      const deadWorkerIds = deadWorkers.map((w) => w.id);

      console.log(`[ReaperDaemon] Detected ${deadWorkerIds.length} dead worker(s):`, deadWorkerIds);

      // 2. Mark dead workers in DB
      await prisma.worker.updateMany({
        where: { id: { in: deadWorkerIds } },
        data: { status: WorkerStatus.DEAD, activeJobsCount: 0 },
      });

      // 3. Find orphaned jobs in CLAIMED or RUNNING status
      const orphanedJobs = await prisma.job.findMany({
        where: {
          claimedByWorkerId: { in: deadWorkerIds },
          status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
        },
      });

      if (orphanedJobs.length === 0) return;

      console.log(`[ReaperDaemon] Reclaiming ${orphanedJobs.length} orphaned job(s) from dead workers...`);

      for (const job of orphanedJobs) {
        const newRetryCount = job.retryCount + 1;
        const maxRetries = job.maxRetries ?? 3;

        if (newRetryCount < maxRetries) {
          await prisma.$transaction([
            prisma.job.update({
              where: { id: job.id },
              data: {
                status: JobStatus.QUEUED,
                retryCount: newRetryCount,
                claimedByWorkerId: null,
                claimedAt: null,
                startedAt: null,
                runAt: new Date(),
                updatedAt: new Date(),
              },
            }),
            prisma.jobLog.create({
              data: {
                jobId: job.id,
                jobExecutionId: job.id, // reference fallback
                level: LogLevel.WARN,
                message: `Assigned worker was declared dead. Job re-queued by ReaperDaemon (attempt ${newRetryCount}/${maxRetries}).`,
              },
            }),
          ]);
        } else {
          // Route to DLQ
          await prisma.$transaction([
            prisma.job.update({
              where: { id: job.id },
              data: {
                status: JobStatus.DEAD_LETTERED,
                retryCount: newRetryCount,
                claimedByWorkerId: null,
                updatedAt: new Date(),
              },
            }),
            prisma.deadLetterQueueEntry.create({
              data: {
                jobId: job.id,
                queueId: job.queueId,
                projectId: job.projectId,
                originalPayload: job.payload || {},
                failureReason: 'Assigned worker died or became unresponsive mid-execution (Retries exhausted)',
                totalAttempts: newRetryCount,
              },
            }),
            prisma.jobLog.create({
              data: {
                jobId: job.id,
                jobExecutionId: job.id,
                level: LogLevel.ERROR,
                message: 'Worker died and retries exhausted. Job routed to Dead Letter Queue (DLQ).',
              },
            }),
          ]);
        }
      }
    } catch (error) {
      console.error('[ReaperDaemon] Error during reaper pass:', error);
    }
  }
}
