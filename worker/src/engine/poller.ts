import { prisma } from '../lib/prisma.js';
import { JobStatus } from '@scheduler/shared';

export interface ClaimedJobRecord {
  id: string;
  projectId: string;
  queueId: string;
  name: string;
  handlerType: string;
  jobType: string;
  status: string;
  priority: number;
  payload: any;
  retryCount: number;
  maxRetries: number;
  retryPolicyId: string | null;
  timeoutMs: number;
}

export class Poller {
  /**
   * Atomically claims available queued jobs across unpaused queues
   * using PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED
   */
  static async claimJobs(
    workerId: string,
    availableSlots: number
  ): Promise<ClaimedJobRecord[]> {
    if (availableSlots <= 0) {
      return [];
    }

    // 1. Fetch unpaused queues sorted by priority descending
    const queues = await prisma.queue.findMany({
      where: { isPaused: false },
      orderBy: { priority: 'desc' },
      select: { id: true, concurrencyLimit: true },
    });

    if (queues.length === 0) {
      return [];
    }

    const claimedJobs: ClaimedJobRecord[] = [];
    let remainingSlots = availableSlots;

    for (const queue of queues) {
      if (remainingSlots <= 0) break;

      // Check current active jobs in this queue against queue's concurrencyLimit
      const activeRunningInQueue = await prisma.job.count({
        where: {
          queueId: queue.id,
          status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
        },
      });

      const allowedForQueue = Math.max(0, queue.concurrencyLimit - activeRunningInQueue);
      if (allowedForQueue <= 0) {
        continue;
      }

      const limit = Math.min(remainingSlots, allowedForQueue);

      // Execute Atomic SELECT ... FOR UPDATE SKIP LOCKED query
      const claimedInQueue = await prisma.$transaction(async (tx) => {
        const rows: { id: string }[] = await tx.$queryRaw`
          SELECT id FROM jobs
          WHERE "queueId" = ${queue.id}
            AND status = 'QUEUED'
            AND "runAt" <= NOW()
          ORDER BY priority DESC, "runAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;

        if (rows.length === 0) {
          return [];
        }

        const jobIds = rows.map((r) => r.id);

        // Update claimed jobs in the same transaction
        await tx.job.updateMany({
          where: { id: { in: jobIds } },
          data: {
            status: JobStatus.CLAIMED,
            claimedByWorkerId: workerId,
            claimedAt: new Date(),
          },
        });

        return tx.job.findMany({
          where: { id: { in: jobIds } },
          select: {
            id: true,
            projectId: true,
            queueId: true,
            name: true,
            handlerType: true,
            jobType: true,
            status: true,
            priority: true,
            payload: true,
            retryCount: true,
            maxRetries: true,
            retryPolicyId: true,
            timeoutMs: true,
          },
        });
      });

      claimedJobs.push(...(claimedInQueue as any[]));
      remainingSlots -= claimedInQueue.length;
    }

    return claimedJobs;
  }
}
