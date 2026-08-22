import { CronExpressionParser } from 'cron-parser';
import { prisma } from '../lib/prisma.js';
import { JobStatus, JobType } from '@scheduler/shared';

export class CronScheduler {
  /**
   * Evaluates active recurring scheduled jobs whose nextRunAt <= NOW()
   * and spawns their corresponding Job instance into the queue
   */
  static async tick(): Promise<number> {
    const dueSchedules = await prisma.scheduledJob.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: new Date() },
      },
    });

    if (dueSchedules.length === 0) {
      return 0;
    }

    let spawnedCount = 0;

    for (const schedule of dueSchedules) {
      // Calculate the next recurrence interval
      let nextRunAt: Date;
      try {
        const interval = CronExpressionParser.parse(schedule.cronExpression, {
          tz: schedule.timezone,
        });
        nextRunAt = interval.next().toDate();
      } catch {
        nextRunAt = new Date(Date.now() + 60000);
      }

      await prisma.$transaction(async (tx) => {
        // Spawn the job instance
        await tx.job.create({
          data: {
            projectId: schedule.projectId,
            queueId: schedule.queueId,
            name: `${schedule.name} (${new Date().toISOString()})`,
            handlerType: schedule.handlerType,
            jobType: JobType.CRON,
            status: JobStatus.QUEUED,
            priority: schedule.priority,
            payload: schedule.payload || {},
            timeoutMs: schedule.timeoutMs,
            maxRetries: schedule.maxRetries,
            retryPolicyId: schedule.retryPolicyId,
            scheduledJobId: schedule.id,
            runAt: new Date(),
          },
        });

        // Update schedule nextRunAt & lastRunAt
        await tx.scheduledJob.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt,
          },
        });
      });

      spawnedCount++;
    }

    return spawnedCount;
  }
}
