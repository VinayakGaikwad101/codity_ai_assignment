import { Router } from 'express';
import { WorkerController } from '../controllers/worker.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', WorkerController.list);
router.get('/:id', WorkerController.getById);

export const workerRoutes = router;
