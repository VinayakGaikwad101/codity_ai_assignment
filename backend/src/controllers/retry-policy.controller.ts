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

      const policy = await RetryPolicyService.createPolicy(organizationId, validated);
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
      const projectId = (req.query.projectId as string) || req.apiKey?.projectId;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!projectId || !organizationId) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'projectId query parameter is required' } });
        return;
      }

      const policies = await RetryPolicyService.listPolicies(projectId, organizationId);
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

      const policy = await RetryPolicyService.getPolicyById(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: policy,
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

      await RetryPolicyService.deletePolicy(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: { message: 'Retry policy deleted successfully' },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
