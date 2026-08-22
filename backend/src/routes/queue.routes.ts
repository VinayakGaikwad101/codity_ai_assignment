import { Router } from 'express';
import { QueueController } from '../controllers/queue.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

router.use(authenticate);

router.post('/', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), QueueController.create);
router.get('/', QueueController.list);
router.get('/:id', QueueController.getById);
router.put('/:id', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), QueueController.update);
router.post('/:id/pause', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), QueueController.togglePause);
router.get('/:id/stats', QueueController.getStats);
router.delete('/:id', requireRole([UserRole.ADMIN]), QueueController.delete);

export const queueRoutes = router;
