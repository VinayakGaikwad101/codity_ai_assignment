import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// API Key management (Protected)
router.post('/api-keys', authenticate, requireRole([UserRole.ADMIN]), AuthController.createApiKey);
router.get('/api-keys', authenticate, AuthController.listApiKeys);
router.delete('/api-keys/:id', authenticate, requireRole([UserRole.ADMIN]), AuthController.revokeApiKey);

export const authRoutes = router;
