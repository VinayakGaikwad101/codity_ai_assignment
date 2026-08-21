import { prisma } from '../lib/prisma.js';
import { JobStatus, WorkerStatus, SystemMetrics } from '@scheduler/shared';

export class MetricsService {
  static async getSystemOverview(projectId?: string, organizationId?: string): Promise<SystemMetrics> {
    const whereJob: any = {};
    const whereQueue: any = {};

    if (projectId) {
      whereJob.projectId = projectId;
      whereQueue.projectId = projectId;
    } else if (organizationId) {
      whereJob.project = { organizationId };
      whereQueue.project = { organizationId };
    }

    const [
      totalQueues,
      activeWorkers,
      totalJobsProcessed,
      jobsRunning,
      jobsQueued,
      jobsFailed,
      jobsDeadLettered,
    ] = await Promise.all([
      prisma.queue.count({ where: whereQueue }),
      prisma.worker.count({
        where: {
          status: WorkerStatus.HEALTHY,
          lastHeartbeatAt: { gte: new Date(Date.now() - 30000) },
        },
      }),
      prisma.job.count({
        where: {
          ...whereJob,
          status: { in: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.DEAD_LETTERED] },
        },
      }),
      prisma.job.count({ where: { ...whereJob, status: JobStatus.RUNNING } }),
      prisma.job.count({ where: { ...whereJob, status: JobStatus.QUEUED } }),
      prisma.job.count({ where: { ...whereJob, status: JobStatus.FAILED } }),
      prisma.deadLetterQueueEntry.count({
        where: projectId ? { projectId } : organizationId ? { project: { organizationId } } : {},
      }),
    ]);

    const successfulJobs = await prisma.job.count({
      where: { ...whereJob, status: JobStatus.COMPLETED },
    });

    const overallSuccessRate =
      totalJobsProcessed > 0
        ? Math.round((successfulJobs / totalJobsProcessed) * 100 * 10) / 10
        : 100;

    return {
      totalQueues,
      activeWorkers,
      totalJobsProcessed,
      jobsRunning,
      jobsQueued,
      jobsFailed,
      jobsDeadLettered,
      overallSuccessRate,
      timestamp: new Date().toISOString(),
    };
  }

  static async getThroughputHistory(projectId?: string, organizationId?: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const executions = await prisma.jobExecution.findMany({
      where: {
        startedAt: { gte: oneDayAgo },
        job: projectId
          ? { projectId }
          : organizationId
          ? { project: { organizationId } }
          : {},
      },
      select: {
        status: true,
        startedAt: true,
        durationMs: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    // Group executions by 1-hour buckets
    const hourlyBuckets: Record<string, { hour: string; completed: number; failed: number; avgDurationMs: number; totalDuration: number }> = {};

    for (let i = 23; i >= 0; i--) {
      const bucketTime = new Date(Date.now() - i * 60 * 60 * 1000);
      const hourKey = bucketTime.toISOString().substring(0, 13) + ':00';
      hourlyBuckets[hourKey] = {
        hour: hourKey,
        completed: 0,
        failed: 0,
        avgDurationMs: 0,
        totalDuration: 0,
      };
    }

    for (const exec of executions) {
      const hourKey = exec.startedAt.toISOString().substring(0, 13) + ':00';
      if (hourlyBuckets[hourKey]) {
        if (exec.status === 'SUCCESS') {
          hourlyBuckets[hourKey].completed += 1;
        } else {
          hourlyBuckets[hourKey].failed += 1;
        }
        if (exec.durationMs) {
          hourlyBuckets[hourKey].totalDuration += exec.durationMs;
        }
      }
    }

    return Object.values(hourlyBuckets).map((b) => ({
      hour: b.hour,
      completed: b.completed,
      failed: b.failed,
      avgDurationMs:
        b.completed + b.failed > 0
          ? Math.round(b.totalDuration / (b.completed + b.failed))
          : 0,
    }));
  }
}
