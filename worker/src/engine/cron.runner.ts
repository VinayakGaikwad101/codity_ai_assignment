import { CronExpressionParser } from 'cron-parser';
import { prisma } from '../lib/prisma.js';
import { JobStatus, JobType } from '@scheduler/shared';

export class CronRunner {
  private timer: NodeJS.Timeout | null = null;

  constructor(private intervalMs: number) {}

  start(): void {
    this.timer = setInterval(async () => {
      await this.evaluateCronTriggers();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async evaluateCronTriggers(): Promise<void> {
    try {
      const now = new Date();

      // Find all active scheduled jobs whose nextRunAt <= NOW()
      const dueJobs = await prisma.scheduledJob.findMany({
        where: {
          isActive: true,
          nextRunAt: { lte: now },
        },
      });

      if (dueJobs.length === 0) return;

      for (const cronJob of dueJobs) {
        // Calculate the subsequent nextRunAt
        let subsequentRunAt: Date;
        try {
          const interval = CronExpressionParser.parse(cronJob.cronExpression, { tz: cronJob.timezone || 'UTC' });
          subsequentRunAt = interval.next().toDate();
        } catch {
          subsequentRunAt = new Date(Date.now() + 60 * 1000);
        }

        await prisma.$transaction(async (tx) => {
          // 1. Update scheduled job's nextRunAt
          await tx.scheduledJob.update({
            where: { id: cronJob.id },
            data: {
              lastRunAt: now,
              nextRunAt: subsequentRunAt,
            },
          });

          // 2. Spawn a concrete queued job
          await tx.job.create({
            data: {
              projectId: cronJob.projectId,
              queueId: cronJob.queueId,
              name: `[Cron] ${cronJob.name}`,
              handlerType: cronJob.handlerType,
              jobType: JobType.RECURRING,
              status: JobStatus.QUEUED,
              priority: cronJob.priority,
              payload: cronJob.payload || {},
              timeoutMs: cronJob.timeoutMs,
              maxRetries: cronJob.maxRetries,
              retryPolicyId: cronJob.retryPolicyId,
              scheduledJobId: cronJob.id,
              runAt: now,
            },
          });
        });

        console.log(`[CronRunner] Spawned recurring job "${cronJob.name}". Next run at ${subsequentRunAt.toISOString()}`);
      }
    } catch (error) {
      console.error('[CronRunner] Error evaluating cron triggers:', error);
    }
  }
}
