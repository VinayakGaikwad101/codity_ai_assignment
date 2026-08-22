import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { AppError } from './error.middleware.js';
import { AuthenticatedRequest, JwtPayload } from '../types/auth.types.js';
import { UserRole } from '@scheduler/shared';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    // 1. Authenticate via Bearer JWT Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        req.user = {
          userId: decoded.sub || decoded.userId,
          organizationId: decoded.organizationId,
          email: decoded.email,
          role: decoded.role as UserRole,
        };
        return next();
      } catch (err: any) {
        throw new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN');
      }
    }

    // 2. Authenticate via SHA-256 Hashed Machine API Key
    if (apiKeyHeader) {
      const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { organization: true },
      });

      if (!apiKey) {
        throw new AppError('Invalid API key provided', 401, 'INVALID_API_KEY');
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        throw new AppError('API key has expired', 401, 'EXPIRED_API_KEY');
      }

      // Update lastUsedAt asynchronously in background
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch((e) => console.error('[ApiKey Telemetry Error]:', e));

      req.apiKey = {
        id: apiKey.id,
        organizationId: apiKey.organizationId,
        projectId: apiKey.projectId,
        role: apiKey.role as UserRole,
      };
      return next();
    }

    throw new AppError('Authentication required. Provide Bearer token or X-API-Key header', 401, 'UNAUTHORIZED');
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role || req.apiKey?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      next(new AppError('Forbidden: Insufficient privileges for this operation', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
};
