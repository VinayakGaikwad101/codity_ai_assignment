import { prisma } from '../lib/prisma.js';
import { JobStatus, WorkerStatus, LogLevel } from '@scheduler/shared';

export class ZombieReaper {
  /**
   * Identifies offline or crashed workers (no heartbeat in >30s)
   * and re-queues their in-flight claimed jobs so tasks are never lost
   */
  static async reapDeadWorkers(): Promise<number> {
    const deadThreshold = new Date(Date.now() - 30000);

    const deadWorkers = await prisma.worker.findMany({
      where: {
        status: { in: [WorkerStatus.HEALTHY, WorkerStatus.DEGRADED] },
        lastHeartbeatAt: { lt: deadThreshold },
      },
    });

    if (deadWorkers.length === 0) {
      return 0;
    }

    let recoveredJobsCount = 0;

    for (const worker of deadWorkers) {
      // Mark worker offline
      await prisma.worker.update({
        where: { id: worker.id },
        data: { status: WorkerStatus.OFFLINE },
      });

      // Find jobs stuck in CLAIMED or RUNNING by this dead worker
      const orphanedJobs = await prisma.job.findMany({
        where: {
          claimedByWorkerId: worker.id,
          status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
        },
      });

      if (orphanedJobs.length > 0) {
        await prisma.$transaction([
          prisma.job.updateMany({
            where: { id: { in: orphanedJobs.map((j) => j.id) } },
            data: {
              status: JobStatus.QUEUED,
              claimedByWorkerId: null,
              claimedAt: null,
              startedAt: null,
            },
          }),
          ...orphanedJobs.map((job) =>
            prisma.jobLog.create({
              data: {
                jobId: job.id,
                level: LogLevel.WARN,
                message: `Worker ${worker.hostname} (${worker.id}) heartbeat timed out. Job safely re-queued by Reaper.`,
              },
            })
          ),
        ]);

        recoveredJobsCount += orphanedJobs.length;
      }
    }

    return recoveredJobsCount;
  }
}
