import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  CreateJobDto,
  CreateBatchJobsDto,
  JobFilterQueryDto,
  JobStatus,
  JobType,
  PaginatedResponse,
} from '@scheduler/shared';

export class JobService {
  static async createJob(organizationId: string, dto: CreateJobDto) {
    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: dto.projectId, organizationId },
    });
    if (!project) {
      throw new AppError('Project not found in your organization', 404, 'PROJECT_NOT_FOUND');
    }

    // Verify queue belongs to project
    const queue = await prisma.queue.findFirst({
      where: { id: dto.queueId, projectId: dto.projectId },
    });
    if (!queue) {
      throw new AppError('Queue not found in the specified project', 404, 'QUEUE_NOT_FOUND');
    }

    // Check idempotency key if provided
    if (dto.idempotencyKey) {
      const existingJob = await prisma.job.findUnique({
        where: {
          projectId_idempotencyKey: {
            projectId: dto.projectId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (existingJob) {
        return existingJob;
      }
    }

    // Calculate runAt timestamp
    let runAt = new Date();
    let computedJobType = dto.jobType || JobType.IMMEDIATE;
    let initialStatus = JobStatus.QUEUED;

    if (dto.delayMs && dto.delayMs > 0) {
      runAt = new Date(Date.now() + dto.delayMs);
      computedJobType = JobType.DELAYED;
      initialStatus = JobStatus.SCHEDULED;
    } else if (dto.runAt) {
      runAt = new Date(dto.runAt);
      computedJobType = JobType.SCHEDULED;
      if (runAt.getTime() > Date.now()) {
        initialStatus = JobStatus.SCHEDULED;
      }
    }

    // If DAG dependencies are specified, job starts in SCHEDULED state until dependencies resolve
    if (dto.dependsOnJobIds && dto.dependsOnJobIds.length > 0) {
      computedJobType = JobType.WORKFLOW_NODE;
      initialStatus = JobStatus.SCHEDULED;
    }

    const priority = dto.priority !== undefined ? dto.priority : queue.priority;
    const retryPolicyId = dto.retryPolicyId || queue.retryPolicyId;

    // Determine max retries from policy if available
    let maxRetries = dto.maxRetries ?? 3;
    if (retryPolicyId) {
      const policy = await prisma.retryPolicy.findUnique({ where: { id: retryPolicyId } });
      if (policy) {
        maxRetries = policy.maxRetries;
      }
    }

    const job = await prisma.$transaction(async (tx) => {
      const newJob = await tx.job.create({
        data: {
          projectId: dto.projectId,
          queueId: dto.queueId,
          name: dto.name,
          handlerType: dto.handlerType,
          jobType: computedJobType,
          status: initialStatus,
          priority,
          payload: dto.payload || {},
          idempotencyKey: dto.idempotencyKey,
          runAt,
          timeoutMs: dto.timeoutMs || 60000,
          maxRetries,
          retryPolicyId,
          parentJobId: dto.parentJobId,
        },
      });

      // Insert DAG dependencies if present
      if (dto.dependsOnJobIds && dto.dependsOnJobIds.length > 0) {
        await tx.jobDependency.createMany({
          data: dto.dependsOnJobIds.map((parentId) => ({
            parentJobId: parentId,
            childJobId: newJob.id,
          })),
          skipDuplicates: true,
        });
      }

      return newJob;
    });

    return job;
  }

  static async createBatchJobs(organizationId: string, dto: CreateBatchJobsDto) {
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

    return prisma.$transaction(async (tx) => {
      // 1. Create parent batch job
      const parentBatchJob = await tx.job.create({
        data: {
          projectId: dto.projectId,
          queueId: dto.queueId,
          name: `Batch: ${dto.batchName}`,
          jobType: JobType.BATCH_PARENT,
          status: JobStatus.QUEUED,
          priority: queue.priority,
          payload: { batchSize: dto.jobs.length, batchName: dto.batchName },
          runAt: new Date(),
        },
      });

      // 2. Create child batch items
      const childJobsData = dto.jobs.map((item) => ({
        projectId: dto.projectId,
        queueId: dto.queueId,
        name: item.name,
        handlerType: item.handlerType,
        jobType: JobType.BATCH_CHILD,
        status: JobStatus.QUEUED,
        priority: item.priority !== undefined ? item.priority : queue.priority,
        payload: item.payload || {},
        idempotencyKey: item.idempotencyKey,
        parentJobId: parentBatchJob.id,
        retryPolicyId: queue.retryPolicyId,
        runAt: new Date(),
      }));

      await tx.job.createMany({
        data: childJobsData,
      });

      const childJobs = await tx.job.findMany({
        where: { parentJobId: parentBatchJob.id },
      });

      return {
        parentBatchJob,
        childJobsCount: childJobs.length,
        childJobs,
      };
    });
  }

  static async listJobs(
    organizationId: string,
    query: JobFilterQueryDto
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, status, queueId, projectId, search, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      project: { organizationId },
    };

    if (projectId) where.projectId = projectId;
    if (queueId) where.queueId = queueId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { id: { equals: search } },
      ];
    }

    const orderBy: any = {};
    if (sortBy === 'priority') {
      orderBy.priority = sortOrder;
    } else if (sortBy === 'runAt') {
      orderBy.runAt = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          queue: { select: { id: true, name: true, priority: true } },
          claimedByWorker: { select: { id: true, hostname: true, status: true } },
          _count: { select: { executions: true, jobLogs: true } },
        },
      }),
      prisma.job.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  static async getJobById(id: string, organizationId: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        project: true,
        queue: true,
        retryPolicy: true,
        claimedByWorker: true,
        executions: {
          orderBy: { attemptNumber: 'desc' },
          include: {
            worker: { select: { id: true, hostname: true } },
            logs: { orderBy: { timestamp: 'asc' } },
          },
        },
        jobLogs: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
        parentDependencies: {
          include: {
            parentJob: { select: { id: true, name: true, status: true } },
          },
        },
        childDependencies: {
          include: {
            childJob: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    if (!job || job.project.organizationId !== organizationId) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    return job;
  }

  static async cancelJob(id: string, organizationId: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!job || job.project.organizationId !== organizationId) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
      throw new AppError(`Cannot cancel a job with status ${job.status}`, 400, 'INVALID_STATE');
    }

    return prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.CANCELLED,
        claimedByWorkerId: null,
      },
    });
  }

  static async retryJob(id: string, organizationId: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!job || job.project.organizationId !== organizationId) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    if (job.status !== JobStatus.FAILED && job.status !== JobStatus.DEAD_LETTERED && job.status !== JobStatus.CANCELLED) {
      throw new AppError('Only failed, dead-lettered, or cancelled jobs can be retried', 400, 'INVALID_STATE');
    }

    return prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.QUEUED,
        runAt: new Date(),
        claimedByWorkerId: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
      },
    });
  }

  static async listDlq(organizationId: string, projectId?: string, page = 1, limit = 20) {
    const whereClause: any = {
      project: { organizationId },
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.deadLetterQueueEntry.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { deadLetteredAt: 'desc' },
        include: {
          job: { select: { id: true, name: true, handlerType: true, retryCount: true, maxRetries: true } },
          queue: { select: { id: true, name: true } },
        },
      }),
      prisma.deadLetterQueueEntry.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  static async replayDlq(dlqId: string, organizationId: string) {
    const dlqEntry = await prisma.deadLetterQueueEntry.findUnique({
      where: { id: dlqId },
      include: { project: true, job: true },
    });

    if (!dlqEntry || dlqEntry.project.organizationId !== organizationId) {
      throw new AppError('Dead letter queue entry not found', 404, 'DLQ_ENTRY_NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      // Replay original job
      const replayedJob = await tx.job.update({
        where: { id: dlqEntry.jobId },
        data: {
          status: JobStatus.QUEUED,
          retryCount: 0,
          runAt: new Date(),
          claimedByWorkerId: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
        },
      });

      await tx.deadLetterQueueEntry.update({
        where: { id: dlqId },
        data: {
          replayedAt: new Date(),
          replayedJobId: replayedJob.id,
        },
      });

      return replayedJob;
    });
  }
}
