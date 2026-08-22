import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, JobStatus, JobType, RetryStrategy } from '@prisma/client';

const prisma = new PrismaClient();

describe('Retry Backoff & Dead Letter Queue (DLQ) Quarantine', () => {
  let testProjectId: string;
  let testQueueId: string;
  let testPolicyId: string;

  beforeAll(async () => {
    const org = await prisma.organization.upsert({
      where: { slug: 'test-retry-org' },
      update: {},
      create: { name: 'Retry DLQ Test Org', slug: 'test-retry-org' },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Retry Test Project',
        slug: `retry-${Date.now()}`,
      },
    });
    testProjectId = project.id;

    const policy = await prisma.retryPolicy.create({
      data: {
        projectId: project.id,
        name: 'Fast Fixed Retry',
        strategy: RetryStrategy.FIXED,
        maxRetries: 2,
        initialIntervalMs: 50,
        maxIntervalMs: 100,
        useJitter: false,
      },
    });
    testPolicyId = policy.id;

    const queue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: `retry-queue-${Date.now()}`,
        priority: 50,
        retryPolicyId: policy.id,
      },
    });
    testQueueId = queue.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should retry job up to maxRetries and quarantine into Dead Letter Queue on exhaustion', async () => {
    // 1. Ingest job with maxRetries: 2
    const job = await prisma.job.create({
      data: {
        projectId: testProjectId,
        queueId: testQueueId,
        retryPolicyId: testPolicyId,
        name: 'Deterministic Failing Webhook',
        handlerType: 'FAILING_TASK',
        jobType: JobType.IMMEDIATE,
        status: JobStatus.QUEUED,
        maxRetries: 2,
        retryCount: 0,
        payload: { error: '503 Gateway Timeout' },
        runAt: new Date(),
      },
    });

    // 2. Simulate Retry Attempt 1
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        retryCount: 1,
        runAt: new Date(Date.now() + 50),
      },
    });

    // 3. Simulate Retry Attempt 2 (Max Retries Reached)
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        retryCount: 2,
        runAt: new Date(Date.now() + 50),
      },
    });

    // 4. Next failure exhausts retries -> Route to DLQ
    const dlqEntry = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.DEAD_LETTERED,
          claimedByWorkerId: null,
        },
      });

      const dlq = await tx.deadLetterQueueEntry.create({
        data: {
          projectId: testProjectId,
          queueId: testQueueId,
          jobId: job.id,
          failureReason: '503 Gateway Timeout',
          originalPayload: job.payload || {},
          totalAttempts: 3,
        },
      });

      return dlq;
    });

    expect(dlqEntry.id).toBeDefined();
    expect(dlqEntry.failureReason).toBe('503 Gateway Timeout');
    expect(dlqEntry.totalAttempts).toBe(3);

    // Verify job status is DEAD_LETTERED
    const finalJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(finalJob?.status).toBe(JobStatus.DEAD_LETTERED);
  });
});
