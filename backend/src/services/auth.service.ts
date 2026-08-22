import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/error.middleware.js';
import { RegisterUserDto, LoginUserDto, CreateApiKeyDto, UserRole } from '@scheduler/shared';

export class AuthService {
  static async register(dto: RegisterUserDto) {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new AppError('A user with this email address already exists', 409, 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const slug = dto.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    const result = await prisma.$transaction(async (tx) => {
      let org = await tx.organization.findUnique({ where: { slug } });
      if (!org) {
        org = await tx.organization.create({
          data: {
            name: dto.organizationName,
            slug,
          },
        });
      }

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: dto.email.toLowerCase().trim(),
          name: dto.name,
          passwordHash,
          role: UserRole.ADMIN,
        },
      });

      const project = await tx.project.create({
        data: {
          organizationId: org.id,
          name: 'Default Project',
          slug: 'default-project',
          description: 'Default project workspace',
        },
      });

      return { user, org, project };
    });

    const token = this.generateJwtToken({
      userId: result.user.id,
      organizationId: result.org.id,
      email: result.user.email,
      role: result.user.role as UserRole,
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organizationId: result.org.id,
        organizationName: result.org.name,
      },
      token,
    };
  }

  static async login(dto: LoginUserDto) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { organization: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password credentials', 401, 'INVALID_CREDENTIALS');
    }

    const token = this.generateJwtToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role as UserRole,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
      token,
    };
  }

  static async generateApiKey(organizationId: string, dto: CreateApiKeyDto) {
    const rawSecret = crypto.randomBytes(24).toString('hex');
    const rawKey = `djs_live_${rawSecret}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId,
        projectId: dto.projectId,
        name: dto.name,
        keyPrefix,
        keyHash,
        role: dto.role || UserRole.OPERATOR,
        expiresAt,
      },
    });

    return {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        role: apiKey.role,
        projectId: apiKey.projectId,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      rawKey,
    };
  }

  static async listApiKeys(organizationId: string) {
    return prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        role: true,
        projectId: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async revokeApiKey(id: string, organizationId: string) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!apiKey || apiKey.organizationId !== organizationId) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    return prisma.apiKey.delete({
      where: { id },
    });
  }

  private static generateJwtToken(payload: { userId: string; organizationId: string; email: string; role: UserRole }): string {
    return jwt.sign(
      {
        sub: payload.userId,
        organizationId: payload.organizationId,
        email: payload.email,
        role: payload.role,
      },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
}
