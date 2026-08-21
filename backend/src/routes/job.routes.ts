import { Router } from 'express';
import { JobController } from '../controllers/job.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

router.use(authenticate);

// Job submission & listing
router.post('/', JobController.create);
router.post('/batch', JobController.createBatch);
router.get('/', JobController.list);

// DLQ management
router.get('/dlq', JobController.listDlq);
router.post('/dlq/:id/replay', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.replayDlq);

// Single Job operations
router.get('/:id', JobController.getById);
router.post('/:id/retry', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.retry);
router.post('/:id/cancel', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.cancel);

export const jobRoutes = router;
