import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateProjectDto } from '@scheduler/shared';

export class ProjectService {
  static async createProject(organizationId: string, dto: CreateProjectDto) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    const existing = await prisma.project.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
          slug,
        },
      },
    });

    if (existing) {
      throw new AppError('A project with this name already exists in your organization', 409, 'PROJECT_EXISTS');
    }

    return prisma.project.create({
      data: {
        organizationId,
        name: dto.name,
        slug,
        description: dto.description,
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getProjectById(id: string, organizationId: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        queues: true,
        retryPolicies: true,
      },
    });

    if (!project || project.organizationId !== organizationId) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    return project;
  }
}
