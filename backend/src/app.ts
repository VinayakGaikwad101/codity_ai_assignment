import express, { Express } from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth.routes.js';
import { projectRoutes } from './routes/project.routes.js';
import { retryPolicyRoutes } from './routes/retry-policy.routes.js';
import { queueRoutes } from './routes/queue.routes.js';
import { jobRoutes } from './routes/job.routes.js';
import { cronRoutes } from './routes/cron.routes.js';
import { workerRoutes } from './routes/worker.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

export function createApp(): Express {
  const app = express();

  // Global Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health & Root Status Endpoints
  const statusPayload = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'Distributed Job Scheduler Platform API',
        version: '1.0.0',
        status: 'healthy',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        documentation: 'https://github.com/VinayakGaikwad101/codity_ai_assignment#readme',
      },
    });
  };

  app.get('/health', statusPayload);
  app.get('/api/v1', statusPayload);
  app.get('/api/v1/health', statusPayload);

  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1/retry-policies', retryPolicyRoutes);
  app.use('/api/v1/queues', queueRoutes);
  app.use('/api/v1/jobs', jobRoutes);
  app.use('/api/v1/scheduled-jobs', cronRoutes);
  app.use('/api/v1/workers', workerRoutes);

  // 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
