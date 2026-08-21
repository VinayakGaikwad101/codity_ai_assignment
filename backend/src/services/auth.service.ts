import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/error.middleware.js';
import { UserRole } from '@scheduler/shared';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
  role?: UserRole;
}

export interface CreateApiKeyInput {
  projectId: string;
  name: string;
  expiresInDays?: number;
}

export class AuthService {
  static async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { organization: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
        },
      },
    };
  }

  static async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new AppError('User with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Create organization if new, or connect default
    const orgName = dto.organizationName || `${dto.name}'s Organization`;
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    let organization = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: orgName,
          slug: `${orgSlug}-${Date.now().toString().slice(-4)}`,
        },
      });

      // Also create a default project for this organization
      await prisma.project.create({
        data: {
          organizationId: organization.id,
          name: 'Default Project',
          slug: 'default-project',
          description: 'Default project for job scheduling queues',
        },
      });
    }

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        passwordHash,
        role: dto.role || UserRole.ADMIN,
        organizationId: organization.id,
      },
      include: { organization: true },
    });

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
      },
    };
  }

  static async generateApiKey(input: CreateApiKeyInput) {
    const rawKey = `djs_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 13);
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        keyPrefix,
        hashedKey,
        expiresAt,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      rawApiKey: rawKey, // Only shown once at creation time
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }

  static async listApiKeys(projectId: string) {
    return prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async revokeApiKey(id: string, projectId: string) {
    return prisma.apiKey.deleteMany({
      where: { id, projectId },
    });
  }
}
