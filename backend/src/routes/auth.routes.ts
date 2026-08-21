import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@scheduler/shared';

const router = Router();

// Public routes
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);

// Protected routes
router.get('/me', authenticate, AuthController.getMe);
router.post('/api-keys', authenticate, requireRole([UserRole.ADMIN, UserRole.OPERATOR]), AuthController.createApiKey);
router.get('/api-keys', authenticate, AuthController.listApiKeys);
router.delete('/api-keys/:id', authenticate, requireRole([UserRole.ADMIN]), AuthController.revokeApiKey);

export const authRoutes = router;
