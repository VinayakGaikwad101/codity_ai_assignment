import { Response, NextFunction } from 'express';
import { CronService } from '../services/cron.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { CreateScheduledJobSchema, ApiResponse } from '@scheduler/shared';

export class CronController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateScheduledJobSchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const scheduledJob = await CronService.createScheduledJob(organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: scheduledJob,
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

      const scheduledJobs = await CronService.listScheduledJobs(organizationId, projectId);
      const response: ApiResponse = {
        success: true,
        data: scheduledJobs,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async toggleActive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { isActive } = req.body;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'isActive boolean is required' } });
        return;
      }

      const result = await CronService.toggleScheduledJob(id, organizationId, isActive);
      const response: ApiResponse = {
        success: true,
        data: result,
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

      await CronService.deleteScheduledJob(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: { message: 'Scheduled job deleted successfully' },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
