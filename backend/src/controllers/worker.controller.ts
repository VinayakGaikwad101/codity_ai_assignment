import { Response, NextFunction } from 'express';
import { WorkerFleetService } from '../services/worker.service.js';
import { AuthenticatedRequest } from '../types/auth.types.js';
import { ApiResponse } from '@scheduler/shared';

export class WorkerController {
  static async list(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workers = await WorkerFleetService.listWorkers();
      const response: ApiResponse = {
        success: true,
        data: workers,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const worker = await WorkerFleetService.getWorkerById(id);
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
