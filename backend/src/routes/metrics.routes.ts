import { Router } from 'express';
import { MetricsController } from '../controllers/metrics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/overview', MetricsController.getOverview);
router.get('/throughput', MetricsController.getThroughput);

export const metricsRoutes = router;
