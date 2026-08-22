import { Response, NextFunction } from 'express';
import { JobService } from '../services/job.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import {
  CreateJobSchema,
  CreateBatchJobsSchema,
  JobFilterQuerySchema,
  ApiResponse,
} from '@scheduler/shared';

export class JobController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateJobSchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const job = await JobService.createJob(organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: job,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async createBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateBatchJobsSchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const result = await JobService.createBatchJobs(organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const query = JobFilterQuerySchema.parse(req.query);
      const result = await JobService.listJobs(organizationId, query);
      const response: ApiResponse = {
        success: true,
        data: result,
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

      const job = await JobService.getJobById(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: job,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const job = await JobService.cancelJob(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: job,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async retry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const job = await JobService.retryJob(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: job,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async listDlq(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projectId = (req.query.projectId as string) || req.apiKey?.projectId || undefined;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const result = await JobService.listDlq(organizationId, projectId, page, limit);

      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async replayDlq(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const replayed = await JobService.replayDlq(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: replayed,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async getDlqAiSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const { AiSummaryService } = await import('../services/ai-summary.service.js');
      const summary = await AiSummaryService.generateFailureSummary(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: summary,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
