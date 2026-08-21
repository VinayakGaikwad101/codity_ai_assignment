import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { AppError } from './error.middleware.js';
import { AuthenticatedRequest, AuthUserContext, AuthApiKeyContext } from '../types/auth.types.js';
import { UserRole } from '@scheduler/shared';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

    // 1. API Key Authentication (Machine / Ingest client)
    if (apiKeyHeader || (authHeader && authHeader.startsWith('Bearer djs_live_'))) {
      const rawKey = apiKeyHeader || authHeader?.replace('Bearer ', '');
      if (!rawKey) {
        throw new AppError('Missing API key', 401, 'UNAUTHORIZED');
      }

      const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: { hashedKey },
        include: {
          project: {
            select: { id: true, organizationId: true },
          },
        },
      });

      if (!apiKeyRecord) {
        throw new AppError('Invalid or revoked API key', 401, 'INVALID_API_KEY');
      }

      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        throw new AppError('API key has expired', 401, 'EXPIRED_API_KEY');
      }

      // Update lastUsedAt timestamp asynchronously
      prisma.apiKey
        .update({
          where: { id: apiKeyRecord.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});

      const apiKeyContext: AuthApiKeyContext = {
        id: apiKeyRecord.id,
        projectId: apiKeyRecord.projectId,
        organizationId: apiKeyRecord.project.organizationId,
        name: apiKeyRecord.name,
      };

      req.apiKey = apiKeyContext;
      return next();
    }

    // 2. JWT Bearer Token Authentication (Dashboard / User session)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication credentials required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = jwt.verify(token, config.JWT_SECRET);
    } catch {
      throw new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN');
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
      },
    });

    if (!userRecord) {
      throw new AppError('User belonging to this token no longer exists', 401, 'USER_NOT_FOUND');
    }

    const userContext: AuthUserContext = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role as UserRole,
      organizationId: userRecord.organizationId,
    };

    req.user = userContext;
    return next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    // If authenticated via API Key, it has machine access to its specific project
    if (req.apiKey) {
      return next();
    }

    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Insufficient permissions. Required role: [${allowedRoles.join(', ')}]`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};
