import { Router } from 'express';
import { CronController } from '../controllers/cron.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

router.use(authenticate);

router.post('/', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), CronController.create);
router.get('/', CronController.list);
router.patch('/:id/toggle', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), CronController.toggleActive);
router.delete('/:id', requireRole([UserRole.ADMIN]), CronController.delete);

export const cronRoutes = router;
