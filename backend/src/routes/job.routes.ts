import { Router } from 'express';
import { JobController } from '../controllers/job.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

router.use(authenticate);

router.post('/', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.create);
router.post('/batch', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.createBatch);
router.get('/', JobController.list);
router.get('/dlq', JobController.listDlq);
router.get('/dlq/:id/ai-summary', JobController.getDlqAiSummary);
router.post('/dlq/:id/replay', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.replayDlq);
router.get('/:id', JobController.getById);
router.post('/:id/cancel', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.cancel);
router.post('/:id/retry', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), JobController.retry);

export const jobRoutes = router;
