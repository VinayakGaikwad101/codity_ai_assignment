import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { ApiResponse } from '@scheduler/shared';

export class WorkerController {
  static async listWorkers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workers = await prisma.worker.findMany({
        orderBy: { lastHeartbeatAt: 'desc' },
        include: {
          heartbeats: {
            take: 5,
            orderBy: { recordedAt: 'desc' },
          },
          _count: {
            select: {
              claimedJobs: true,
              executions: true,
            },
          },
        },
      });

      const response: ApiResponse = {
        success: true,
        data: workers,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async getWorkerById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const worker = await prisma.worker.findUnique({
        where: { id },
        include: {
          heartbeats: {
            take: 20,
            orderBy: { recordedAt: 'desc' },
          },
          claimedJobs: {
            take: 10,
            orderBy: { startedAt: 'desc' },
          },
        },
      });

      if (!worker) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Worker not found' } });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: worker,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
