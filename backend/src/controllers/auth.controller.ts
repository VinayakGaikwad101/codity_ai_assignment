import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { ApiResponse, UserRole } from '@scheduler/shared';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  organizationName: z.string().min(2).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

const CreateApiKeySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export class AuthController {
  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = LoginSchema.parse(req.body);
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

  static async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = RegisterSchema.parse(req.body);
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

  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const response: ApiResponse = {
        success: true,
        data: {
          user: req.user || null,
          apiKey: req.apiKey || null,
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async createApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateApiKeySchema.parse(req.body);
      const result = await AuthService.generateApiKey(validated);
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
      const projectId = req.query.projectId as string;
      if (!projectId) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'projectId query parameter is required' } });
        return;
      }
      const keys = await AuthService.listApiKeys(projectId);
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
      const { projectId } = req.body;
      if (!projectId) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'projectId is required' } });
        return;
      }
      await AuthService.revokeApiKey(id, projectId);
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
