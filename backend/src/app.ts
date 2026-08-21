import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { authRoutes } from './routes/auth.routes.js';
import { ApiResponse } from '@scheduler/shared';

export const createApp = (): Application => {
  const app = express();

  // Standard middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'HEALTHY',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };
    res.status(200).json(response);
  });

  // Mount API route modules
  app.use('/api/v1/auth', authRoutes);

  return app;
};
