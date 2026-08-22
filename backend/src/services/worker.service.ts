import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

export class WorkerFleetService {
  static async listWorkers() {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeatAt: 'desc' },
      include: {
        _count: {
          select: {
            claimedJobs: true,
            executions: true,
          },
        },
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    return workers.map((w) => ({
      id: w.id,
      hostname: w.hostname,
      ipAddress: w.ipAddress,
      status: w.status,
      concurrencyLimit: w.concurrencyLimit,
      activeJobsCount: w.activeJobsCount,
      lastHeartbeatAt: w.lastHeartbeatAt,
      startedAt: w.startedAt,
      totalExecutionsCount: w._count.executions,
      latestMetrics: w.heartbeats[0] || null,
    }));
  }

  static async getWorkerById(id: string) {
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        claimedJobs: {
          select: {
            id: true,
            name: true,
            queueId: true,
            status: true,
            priority: true,
            startedAt: true,
          },
        },
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    });

    if (!worker) {
      throw new AppError('Worker node not found', 404, 'WORKER_NOT_FOUND');
    }

    return worker;
  }
}
