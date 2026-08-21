import { Response, NextFunction } from 'express';
import { MetricsService } from '../services/metrics.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { ApiResponse } from '@scheduler/shared';

export class MetricsController {
  static async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projectId = (req.query.projectId as string) || req.apiKey?.projectId;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      const overview = await MetricsService.getSystemOverview(projectId, organizationId);
      const response: ApiResponse = {
        success: true,
        data: overview,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async getThroughput(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projectId = (req.query.projectId as string) || req.apiKey?.projectId;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;

      const throughput = await MetricsService.getThroughputHistory(projectId, organizationId);
      const response: ApiResponse = {
        success: true,
        data: throughput,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
