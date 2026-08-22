import { Response, NextFunction } from 'express';
import { QueueService } from '../services/queue.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { CreateQueueSchema, UpdateQueueSchema, ApiResponse } from '@scheduler/shared';

export class QueueController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateQueueSchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const queue = await QueueService.createQueue(organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: queue,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projectId = (req.query.projectId as string) || req.apiKey?.projectId || undefined;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const queues = await QueueService.listQueues(organizationId, projectId);
      const response: ApiResponse = {
        success: true,
        data: queues,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const queue = await QueueService.getQueueById(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: queue,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const validated = UpdateQueueSchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const queue = await QueueService.updateQueue(id, organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: queue,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async togglePause(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { isPaused } = req.body;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      if (typeof isPaused !== 'boolean') {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'isPaused boolean field is required' } });
        return;
      }

      const queue = await QueueService.setQueuePaused(id, organizationId, isPaused);
      const response: ApiResponse = {
        success: true,
        data: queue,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const stats = await QueueService.getQueueStatistics(id);
      const response: ApiResponse = {
        success: true,
        data: stats,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      await QueueService.deleteQueue(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: { message: 'Queue deleted successfully' },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
