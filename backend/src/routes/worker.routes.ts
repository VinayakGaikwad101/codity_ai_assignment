import { Router } from 'express';
import { WorkerController } from '../controllers/worker.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', WorkerController.listWorkers);
router.get('/:id', WorkerController.getWorkerById);

export const workerRoutes = router;
