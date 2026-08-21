import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateRetryPolicyDto } from '@scheduler/shared';

export class RetryPolicyService {
  static async createPolicy(organizationId: string, dto: CreateRetryPolicyDto) {
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
      throw new AppError('A retry policy with this name already exists in the project', 409, 'POLICY_NAME_EXISTS');
    }

    return prisma.retryPolicy.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        strategy: dto.strategy,
        maxRetries: dto.maxRetries,
        baseDelayMs: dto.baseDelayMs,
        maxDelayMs: dto.maxDelayMs,
        jitter: dto.jitter,
      },
    });
  }

  static async listPolicies(projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new AppError('Project not found in your organization', 404, 'PROJECT_NOT_FOUND');
    }

    return prisma.retryPolicy.findMany({
      where: { projectId },
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

  static async getPolicyById(id: string, organizationId: string) {
    const policy = await prisma.retryPolicy.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!policy || policy.project.organizationId !== organizationId) {
      throw new AppError('Retry policy not found', 404, 'POLICY_NOT_FOUND');
    }

    return policy;
  }

  static async deletePolicy(id: string, organizationId: string) {
    const policy = await prisma.retryPolicy.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!policy || policy.project.organizationId !== organizationId) {
      throw new AppError('Retry policy not found', 404, 'POLICY_NOT_FOUND');
    }

    return prisma.retryPolicy.delete({
      where: { id },
    });
  }
}
