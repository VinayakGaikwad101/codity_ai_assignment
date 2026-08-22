import express, { Express } from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/project.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

export function createApp(): Express {
  const app = express();

  // Global Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health Check Endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'distributed-job-scheduler-api',
    });
  });

  // Module 3 Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/projects', projectRoutes);

  // 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
