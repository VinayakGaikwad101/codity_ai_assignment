import { Response, NextFunction } from 'express';
import { ProjectService } from '../services/project.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { CreateProjectSchema, ApiResponse } from '@scheduler/shared';

export class ProjectController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = CreateProjectSchema.parse(req.body);
      const organizationId = req.user?.organizationId || req.apiKey?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Organization context missing' } });
        return;
      }

      const project = await ProjectService.createProject(organizationId, validated);
      const response: ApiResponse = {
        success: true,
        data: project,
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

      const projects = await ProjectService.listProjects(organizationId);
      const response: ApiResponse = {
        success: true,
        data: projects,
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

      const project = await ProjectService.getProjectById(id, organizationId);
      const response: ApiResponse = {
        success: true,
        data: project,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
