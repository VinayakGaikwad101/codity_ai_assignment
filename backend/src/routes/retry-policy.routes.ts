import { Router } from 'express';
import { RetryPolicyController } from '../controllers/retry-policy.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

router.use(authenticate);

router.post('/', requireRole([UserRole.ADMIN, UserRole.OPERATOR]), RetryPolicyController.create);
router.get('/', RetryPolicyController.list);
router.get('/:id', RetryPolicyController.getById);
router.delete('/:id', requireRole([UserRole.ADMIN]), RetryPolicyController.delete);

export const retryPolicyRoutes = router;
