import { Response, NextFunction } from 'express';
import { RetryPolicyService } from '../services/retry-policy.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { CreateRetryPolicySchema, ApiResponse } from '@scheduler/shared';

export class RetryPolicyController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateRetryPolicySchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const policy = await RetryPolicyService.create(organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: policy,
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

      const policies = await RetryPolicyService.list(organizationId, projectId);
      const response: ApiResponse = {
        success: true,
        data: policies,
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

      const policy = await RetryPolicyService.getById(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: policy,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
