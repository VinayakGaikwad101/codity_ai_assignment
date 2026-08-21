import { CronExpressionParser } from 'cron-parser';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateScheduledJobDto } from '@scheduler/shared';

export class CronService {
  static async createScheduledJob(organizationId: string, dto: CreateScheduledJobDto) {
    const project = await prisma.project.findFirst({
      where: { id: dto.projectId, organizationId },
    });
    if (!project) {
      throw new AppError('Project not found in your organization', 404, 'PROJECT_NOT_FOUND');
    }

    const queue = await prisma.queue.findFirst({
      where: { id: dto.queueId, projectId: dto.projectId },
    });
    if (!queue) {
      throw new AppError('Queue not found in the specified project', 404, 'QUEUE_NOT_FOUND');
    }

    // Validate cron expression
    let nextRunAt: Date;
    try {
      const interval = CronExpressionParser.parse(dto.cronExpression, { tz: dto.timezone || 'UTC' });
      nextRunAt = interval.next().toDate();
    } catch {
      throw new AppError('Invalid cron expression or timezone', 400, 'INVALID_CRON_EXPRESSION');
    }

    return prisma.scheduledJob.create({
      data: {
        projectId: dto.projectId,
        queueId: dto.queueId,
        name: dto.name,
        handlerType: dto.handlerType,
        cronExpression: dto.cronExpression,
        timezone: dto.timezone || 'UTC',
        payload: dto.payload || {},
        priority: dto.priority ?? queue.priority,
        timeoutMs: dto.timeoutMs || 60000,
        maxRetries: dto.maxRetries ?? 3,
        retryPolicyId: dto.retryPolicyId || queue.retryPolicyId,
        isActive: true,
        nextRunAt,
      },
      include: {
        queue: true,
        retryPolicy: true,
      },
    });
  }

  static async listScheduledJobs(projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new AppError('Project not found in your organization', 404, 'PROJECT_NOT_FOUND');
    }

    return prisma.scheduledJob.findMany({
      where: { projectId },
      include: {
        queue: { select: { id: true, name: true } },
        retryPolicy: { select: { id: true, name: true } },
        _count: { select: { spawnedJobs: true } },
      },
      orderBy: { nextRunAt: 'asc' },
    });
  }

  static async toggleScheduledJob(id: string, organizationId: string, isActive: boolean) {
    const scheduledJob = await prisma.scheduledJob.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!scheduledJob || scheduledJob.project.organizationId !== organizationId) {
      throw new AppError('Scheduled job not found', 404, 'SCHEDULED_JOB_NOT_FOUND');
    }

    let nextRunAt = scheduledJob.nextRunAt;
    if (isActive) {
      const interval = CronExpressionParser.parse(scheduledJob.cronExpression, { tz: scheduledJob.timezone });
      nextRunAt = interval.next().toDate();
    }

    return prisma.scheduledJob.update({
      where: { id },
      data: { isActive, nextRunAt },
    });
  }

  static async deleteScheduledJob(id: string, organizationId: string) {
    const scheduledJob = await prisma.scheduledJob.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!scheduledJob || scheduledJob.project.organizationId !== organizationId) {
      throw new AppError('Scheduled job not found', 404, 'SCHEDULED_JOB_NOT_FOUND');
    }

    return prisma.scheduledJob.delete({
      where: { id },
    });
  }
}
