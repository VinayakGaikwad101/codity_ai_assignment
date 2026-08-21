import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, JobStatus, JobHandlerType, WorkerStatus } from '@prisma/client';
import { JobPoller } from '../../worker/src/engine/poller.js';
import { JobExecutor } from '../../worker/src/engine/executor.js';

const prisma = new PrismaClient();

describe('Job Lifecycle & DLQ Integration Tests', () => {
  let testProjectId: string;
  let testQueueId: string;
  let testWorkerId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Lifecycle Test Org',
        slug: `test-lifecycle-${Date.now()}`,
      },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Lifecycle Project',
        slug: `lifecycle-project-${Date.now()}`,
      },
    });
    testProjectId = project.id;

    const queue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: 'lifecycle-queue',
        priority: 50,
        concurrencyLimit: 5,
      },
    });
    testQueueId = queue.id;

    const worker = await prisma.worker.create({
      data: {
        hostname: 'test-executor-node',
        concurrencyLimit: 5,
        status: WorkerStatus.HEALTHY,
      },
    });
    testWorkerId = worker.id;
  });

  afterAll(async () => {
    if (testProjectId) {
      await prisma.project.delete({ where: { id: testProjectId } });
    }
    await prisma.$disconnect();
  });

  it('should complete a successful job through full state transitions (QUEUED -> CLAIMED -> RUNNING -> COMPLETED)', async () => {
    // 1. Create QUEUED job
    const job = await prisma.job.create({
      data: {
        projectId: testProjectId,
        queueId: testQueueId,
        name: 'Sample Success Compute',
        handlerType: JobHandlerType.CUSTOM_COMPUTE,
        status: JobStatus.QUEUED,
        payload: { itemsCount: 42, shouldFail: false },
        runAt: new Date(),
      },
    });

    expect(job.status).toBe(JobStatus.QUEUED);

    // 2. Atomic claim scoped to test queue
    const claimed = await JobPoller.claimJobs(testWorkerId, 1, testQueueId);
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(job.id);
    expect(claimed[0].status).toBe(JobStatus.CLAIMED);

    // 3. Execute
    await JobExecutor.executeJob(testWorkerId, claimed[0]);

    // 4. Verify COMPLETED state in DB
    const finalJob = await prisma.job.findUnique({
      where: { id: job.id },
      include: { executions: true, jobLogs: true },
    });

    expect(finalJob?.status).toBe(JobStatus.COMPLETED);
    expect(finalJob?.completedAt).not.toBeNull();
    expect(finalJob?.executions.length).toBe(1);
    expect(finalJob?.executions[0].status).toBe('SUCCESS');
    expect(finalJob?.jobLogs.length).toBeGreaterThan(0);
  });

  it('should retry a failing job and route to Dead Letter Queue (DLQ) when retries are exhausted', async () => {
    // 1. Create failing job with maxRetries = 1
    const failingJob = await prisma.job.create({
      data: {
        projectId: testProjectId,
        queueId: testQueueId,
        name: 'Intentional Failing Job',
        handlerType: JobHandlerType.CUSTOM_COMPUTE,
        status: JobStatus.QUEUED,
        maxRetries: 1,
        retryCount: 0,
        payload: { shouldFail: true, failureMessage: 'Simulated network exception' },
        runAt: new Date(),
      },
    });

    // 2. Claim & execute attempt #1 (exhausts maxRetries = 1)
    const claimed = await JobPoller.claimJobs(testWorkerId, 1, testQueueId);
    expect(claimed.length).toBe(1);

    await JobExecutor.executeJob(testWorkerId, claimed[0]);

    // 3. Verify DEAD_LETTERED status and DLQ record creation
    const deadJob = await prisma.job.findUnique({
      where: { id: failingJob.id },
      include: { dlqEntries: true, executions: true },
    });

    expect(deadJob?.status).toBe(JobStatus.DEAD_LETTERED);
    expect(deadJob?.retryCount).toBe(1);
    expect(deadJob?.dlqEntries.length).toBe(1);
    expect(deadJob?.dlqEntries[0].failureReason).toContain('Simulated network exception');
  });
});
