import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

router.use(authenticate);

router.post('/', requireRole([UserRole.ADMIN]), ProjectController.create);
router.get('/', ProjectController.list);
router.get('/:id', ProjectController.getById);

export const projectRoutes = router;
