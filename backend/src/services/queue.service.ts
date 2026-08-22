import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateQueueDto, UpdateQueueDto, QueueStatistics, JobStatus } from '@scheduler/shared';

export class QueueService {
  static async createQueue(organizationId: string, dto: CreateQueueDto) {
    const project = await prisma.project.findFirst({
      where: { id: dto.projectId, organizationId },
    });

    if (!project) {
      throw new AppError('Project not found in your organization', 404, 'PROJECT_NOT_FOUND');
    }

    const existing = await prisma.queue.findFirst({
      where: {
        projectId: dto.projectId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new AppError('A queue with this name already exists in the project', 409, 'QUEUE_NAME_EXISTS');
    }

    if (dto.retryPolicyId) {
      const policy = await prisma.retryPolicy.findFirst({
        where: { id: dto.retryPolicyId, projectId: dto.projectId },
      });
      if (!policy) {
        throw new AppError('Specified retry policy not found', 400, 'INVALID_RETRY_POLICY');
      }
    }

    return prisma.queue.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        description: dto.description,
        priority: dto.priority ?? 50,
        concurrencyLimit: dto.concurrencyLimit ?? 10,
        rateLimitPerMin: dto.rateLimitPerMin,
        retryPolicyId: dto.retryPolicyId,
      },
      include: {
        retryPolicy: true,
      },
    });
  }

  static async listQueues(organizationId: string, projectId?: string) {
    const whereClause: any = {
      project: { organizationId },
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    const queues = await prisma.queue.findMany({
      where: whereClause,
      include: {
        retryPolicy: true,
        _count: {
          select: {
            jobs: true,
            dlqEntries: true,
          },
        },
      },
      orderBy: { priority: 'desc' },
    });

    // Compute live stats for each queue
    const queuesWithStats = await Promise.all(
      queues.map(async (q) => {
        const stats = await this.getQueueStatistics(q.id);
        return {
          ...q,
          statistics: stats,
        };
      })
    );

    return queuesWithStats;
  }

  static async getQueueById(id: string, organizationId: string) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        project: true,
        retryPolicy: true,
      },
    });

    if (!queue || queue.project.organizationId !== organizationId) {
      throw new AppError('Queue not found', 404, 'QUEUE_NOT_FOUND');
    }

    const stats = await this.getQueueStatistics(queue.id);

    return {
      ...queue,
      statistics: stats,
    };
  }

  static async updateQueue(id: string, organizationId: string, dto: UpdateQueueDto) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!queue || queue.project.organizationId !== organizationId) {
      throw new AppError('Queue not found', 404, 'QUEUE_NOT_FOUND');
    }

    return prisma.queue.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        priority: dto.priority,
        concurrencyLimit: dto.concurrencyLimit,
        rateLimitPerMin: dto.rateLimitPerMin,
        isPaused: dto.isPaused,
        retryPolicyId: dto.retryPolicyId,
      },
      include: {
        retryPolicy: true,
      },
    });
  }

  static async setQueuePaused(id: string, organizationId: string, isPaused: boolean) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!queue || queue.project.organizationId !== organizationId) {
      throw new AppError('Queue not found', 404, 'QUEUE_NOT_FOUND');
    }

    return prisma.queue.update({
      where: { id },
      data: { isPaused },
      include: { retryPolicy: true },
    });
  }

  static async deleteQueue(id: string, organizationId: string) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!queue || queue.project.organizationId !== organizationId) {
      throw new AppError('Queue not found', 404, 'QUEUE_NOT_FOUND');
    }

    return prisma.queue.delete({
      where: { id },
    });
  }

  static async getQueueStatistics(queueId: string): Promise<QueueStatistics> {
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      select: { id: true, name: true, isPaused: true, concurrencyLimit: true },
    });

    if (!queue) {
      throw new AppError('Queue not found', 404, 'QUEUE_NOT_FOUND');
    }

    const [
      queuedCount,
      scheduledCount,
      runningCount,
      completedCount,
      failedCount,
      deadLetteredCount,
      avgDurationResult,
      recentCompletedCount,
    ] = await Promise.all([
      prisma.job.count({ where: { queueId, status: JobStatus.QUEUED } }),
      prisma.job.count({ where: { queueId, status: JobStatus.SCHEDULED } }),
      prisma.job.count({ where: { queueId, status: JobStatus.RUNNING } }),
      prisma.job.count({ where: { queueId, status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { queueId, status: JobStatus.FAILED } }),
      prisma.deadLetterQueueEntry.count({ where: { queueId } }),
      prisma.jobExecution.aggregate({
        where: { job: { queueId }, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      prisma.job.count({
        where: {
          queueId,
          status: JobStatus.COMPLETED,
          completedAt: { gte: new Date(Date.now() - 60000) },
        },
      }),
    ]);

    return {
      queueId: queue.id,
      queueName: queue.name,
      isPaused: queue.isPaused,
      concurrencyLimit: queue.concurrencyLimit,
      queuedCount,
      scheduledCount,
      runningCount,
      completedCount,
      failedCount,
      deadLetteredCount,
      avgDurationMs: Math.round(avgDurationResult._avg.durationMs || 0),
      throughputPerMinute: recentCompletedCount,
    };
  }
}
