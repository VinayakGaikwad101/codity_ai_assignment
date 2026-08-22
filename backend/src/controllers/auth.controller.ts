import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { RegisterUserSchema, LoginUserSchema, CreateApiKeySchema, ApiResponse } from '@scheduler/shared';
import { AuthenticatedRequest } from '../types/auth.types.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = RegisterUserSchema.parse(req.body);
      const result = await AuthService.register(validated);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = LoginUserSchema.parse(req.body);
      const result = await AuthService.login(validated);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async createApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateApiKeySchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const result = await AuthService.generateApiKey(organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async listApiKeys(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const keys = await AuthService.listApiKeys(organizationId);
      const response: ApiResponse = {
        success: true,
        data: keys,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async revokeApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      await AuthService.revokeApiKey(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: { message: 'API key revoked successfully' },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
