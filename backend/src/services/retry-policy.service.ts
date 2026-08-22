import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateRetryPolicyDto, RetryStrategy } from '@scheduler/shared';

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
    if (projectId) {
      const validProject = await prisma.project.findFirst({
        where: { id: projectId, organizationId },
      });

      if (validProject) {
        const count = await prisma.retryPolicy.count({
          where: { projectId },
        });

        if (count === 0) {
          // Auto-provision 3 standard policies for this project
          await prisma.retryPolicy.createMany({
            data: [
              {
                projectId,
                name: 'Standard Exponential Backoff',
                strategy: RetryStrategy.EXPONENTIAL,
                maxRetries: 3,
                initialIntervalMs: 1000,
                maxIntervalMs: 30000,
                backoffMultiplier: 2.0,
                useJitter: true,
              },
              {
                projectId,
                name: 'Linear Backoff Retry',
                strategy: RetryStrategy.LINEAR,
                maxRetries: 4,
                initialIntervalMs: 2000,
                maxIntervalMs: 15000,
                backoffMultiplier: 1.0,
                useJitter: false,
              },
              {
                projectId,
                name: 'Fixed 5-Second Delay',
                strategy: RetryStrategy.FIXED,
                maxRetries: 2,
                initialIntervalMs: 5000,
                maxIntervalMs: 5000,
                backoffMultiplier: 1.0,
                useJitter: false,
              },
            ],
            skipDuplicates: true,
          });
        }
      }
    }

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
