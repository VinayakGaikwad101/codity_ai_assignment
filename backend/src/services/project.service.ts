import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateProjectDto } from '@scheduler/shared';

export class ProjectService {
  static async createProject(organizationId: string, dto: CreateProjectDto) {
    const existing = await prisma.project.findFirst({
      where: {
        organizationId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new AppError('A project with this slug already exists in this organization', 409, 'SLUG_EXISTS');
    }

    return prisma.project.create({
      data: {
        organizationId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
      },
      include: {
        queues: true,
        retryPolicies: true,
      },
    });
  }

  static async listProjects(organizationId: string) {
    return prisma.project.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            queues: true,
            jobs: true,
            apiKeys: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getProjectById(projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      include: {
        queues: {
          include: {
            retryPolicy: true,
            _count: {
              select: { jobs: true },
            },
          },
        },
        retryPolicies: true,
        apiKeys: {
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    return project;
  }

  static async deleteProject(projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    return prisma.project.delete({
      where: { id: projectId },
    });
  }
}
