import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, JobStatus, WorkerStatus } from '@prisma/client';

const prisma = new PrismaClient();

describe('Concurrency & Atomic SKIP LOCKED Claiming', () => {
  let testProjectId: string;
  let testQueueId: string;
  let worker1Id: string;
  let worker2Id: string;

  beforeAll(async () => {
    // Setup test org, project, and queue
    const org = await prisma.organization.upsert({
      where: { slug: 'test-concurrency-org' },
      update: {},
      create: { name: 'Concurrency Test Org', slug: 'test-concurrency-org' },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Concurrency Test Project',
        slug: `concurrency-${Date.now()}`,
      },
    });
    testProjectId = project.id;

    const queue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: `test-queue-${Date.now()}`,
        priority: 80,
        concurrencyLimit: 20,
      },
    });
    testQueueId = queue.id;

    // Register 2 test workers in database for foreign key validity
    const w1 = await prisma.worker.create({
      data: {
        hostname: 'test-worker-alpha',
        ipAddress: '127.0.0.1',
        concurrencyLimit: 10,
        status: WorkerStatus.HEALTHY,
      },
    });
    worker1Id = w1.id;

    const w2 = await prisma.worker.create({
      data: {
        hostname: 'test-worker-beta',
        ipAddress: '127.0.0.1',
        concurrencyLimit: 10,
        status: WorkerStatus.HEALTHY,
      },
    });
    worker2Id = w2.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should claim 20 concurrent jobs across 2 parallel workers with zero duplicates or race conditions', async () => {
    // 1. Ingest 20 immediate jobs
    const jobInserts = Array.from({ length: 20 }).map((_, i) => ({
      projectId: testProjectId,
      queueId: testQueueId,
      name: `Concurrent Job #${i + 1}`,
      handlerType: 'LEDGER_SETTLEMENT',
      jobType: 'IMMEDIATE' as const,
      status: JobStatus.QUEUED,
      priority: 50,
      payload: { index: i + 1 },
      runAt: new Date(),
    }));

    await prisma.job.createMany({ data: jobInserts });

    // 2. Simulate 2 parallel workers polling using atomic SELECT FOR UPDATE SKIP LOCKED
    const claimJobs = async (workerId: string, limit: number) => {
      return prisma.$transaction(async (tx) => {
        const rows: { id: string }[] = await tx.$queryRaw`
          SELECT id FROM jobs
          WHERE "queueId" = ${testQueueId}
            AND status = 'QUEUED'
            AND "runAt" <= NOW()
          ORDER BY priority DESC, "runAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;

        if (rows.length === 0) return [];

        const ids = rows.map((r) => r.id);
        await tx.job.updateMany({
          where: { id: { in: ids } },
          data: {
            status: JobStatus.CLAIMED,
            claimedByWorkerId: workerId,
            claimedAt: new Date(),
          },
        });

        return ids;
      });
    };

    // Execute parallel claims simultaneously
    const [worker1Claims, worker2Claims] = await Promise.all([
      claimJobs(worker1Id, 10),
      claimJobs(worker2Id, 10),
    ]);

    expect(worker1Claims.length).toBe(10);
    expect(worker2Claims.length).toBe(10);

    // 3. Assert total claimed is 20 and the intersection of claimed IDs is empty (zero duplicate claims!)
    const set1 = new Set(worker1Claims);
    const set2 = new Set(worker2Claims);
    const intersection = [...set1].filter((x) => set2.has(x));

    expect(intersection.length).toBe(0);
  });
});
