import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateRetryPolicyDto } from '@scheduler/shared';

export class RetryPolicyService {
  static async create(organizationId: string, dto: CreateRetryPolicyDto) {
    const project = await prisma.project.findFirst({
      where: { id: dto.projectId, organizationId },
    });

    if (!project) {
      throw new AppError('Project not found in your organization', 404, 'PROJECT_NOT_FOUND');
    }

    const existing = await prisma.retryPolicy.findFirst({
      where: {
        projectId: dto.projectId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new AppError('A retry policy with this name already exists in this project', 409, 'RETRY_POLICY_EXISTS');
    }

    return prisma.retryPolicy.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        strategy: dto.strategy,
        maxRetries: dto.maxRetries,
        initialIntervalMs: dto.initialIntervalMs,
        maxIntervalMs: dto.maxIntervalMs,
        backoffMultiplier: dto.backoffMultiplier,
        useJitter: dto.useJitter,
      },
    });
  }

  static async list(organizationId: string, projectId?: string) {
    const whereClause: any = {
      project: { organizationId },
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    return prisma.retryPolicy.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            queues: true,
            jobs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getById(id: string, organizationId: string) {
    const policy = await prisma.retryPolicy.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!policy || policy.project.organizationId !== organizationId) {
      throw new AppError('Retry policy not found', 404, 'RETRY_POLICY_NOT_FOUND');
    }

    return policy;
  }
}
