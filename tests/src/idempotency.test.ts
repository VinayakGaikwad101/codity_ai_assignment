import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, JobStatus, JobType } from '@prisma/client';

const prisma = new PrismaClient();

describe('Idempotency & Deduplication Engine', () => {
  let testProjectId: string;
  let testQueueId: string;

  beforeAll(async () => {
    const org = await prisma.organization.upsert({
      where: { slug: 'test-idemp-org' },
      update: {},
      create: { name: 'Idempotency Test Org', slug: 'test-idemp-org' },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Idempotency Test Project',
        slug: `idemp-${Date.now()}`,
      },
    });
    testProjectId = project.id;

    const queue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: `idemp-queue-${Date.now()}`,
        priority: 50,
      },
    });
    testQueueId = queue.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return existing job and prevent duplicate insertion when same idempotencyKey is used within 24h', async () => {
    const key = `tx_order_${Date.now()}`;

    // 1. Ingest first job
    const job1 = await prisma.job.create({
      data: {
        projectId: testProjectId,
        queueId: testQueueId,
        name: 'Settle Payment Order #991',
        handlerType: 'LEDGER_SETTLEMENT',
        jobType: JobType.IMMEDIATE,
        status: JobStatus.QUEUED,
        idempotencyKey: key,
        payload: { orderId: 'ord_991', amount: 500 },
        runAt: new Date(),
      },
    });

    expect(job1.id).toBeDefined();

    // 2. Attempt duplicate submission with exact same idempotencyKey
    const existing = await prisma.job.findFirst({
      where: {
        projectId: testProjectId,
        idempotencyKey: key,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    expect(existing).not.toBeNull();
    expect(existing?.id).toBe(job1.id);

    // Assert total jobs with this idempotency key in DB is strictly 1
    const count = await prisma.job.count({
      where: { projectId: testProjectId, idempotencyKey: key },
    });
    expect(count).toBe(1);
  });
});
