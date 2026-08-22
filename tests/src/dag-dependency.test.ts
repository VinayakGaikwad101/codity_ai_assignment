import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, JobStatus, JobType } from '@prisma/client';

const prisma = new PrismaClient();

describe('DAG Workflow Dependencies & Unblocking', () => {
  let testProjectId: string;
  let testQueueId: string;

  beforeAll(async () => {
    const org = await prisma.organization.upsert({
      where: { slug: 'test-dag-org' },
      update: {},
      create: { name: 'DAG Test Org', slug: 'test-dag-org' },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'DAG Test Project',
        slug: `dag-${Date.now()}`,
      },
    });
    testProjectId = project.id;

    const queue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: `dag-queue-${Date.now()}`,
        priority: 50,
      },
    });
    testQueueId = queue.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should hold downstream workflow child jobs in SCHEDULED until parent job is COMPLETED', async () => {
    // 1. Create Parent Job (Step 1)
    const parentJob = await prisma.job.create({
      data: {
        projectId: testProjectId,
        queueId: testQueueId,
        name: 'Step 1: Ingest Data',
        handlerType: 'LEDGER_SETTLEMENT',
        jobType: JobType.IMMEDIATE,
        status: JobStatus.QUEUED,
        priority: 50,
        runAt: new Date(),
      },
    });

    // 2. Create Child Job (Step 2: Generate PDF) in SCHEDULED state
    const childJob = await prisma.job.create({
      data: {
        projectId: testProjectId,
        queueId: testQueueId,
        name: 'Step 2: Generate PDF Receipt',
        handlerType: 'GENERATE_PDF',
        jobType: JobType.WORKFLOW_NODE,
        status: JobStatus.SCHEDULED,
        priority: 50,
        runAt: new Date(),
      },
    });

    // 3. Link dependency in job_dependencies
    await prisma.jobDependency.create({
      data: {
        parentJobId: parentJob.id,
        childJobId: childJob.id,
      },
    });

    // Verify child is blocked in SCHEDULED
    const initialChild = await prisma.job.findUnique({ where: { id: childJob.id } });
    expect(initialChild?.status).toBe(JobStatus.SCHEDULED);

    // 4. Complete parent job
    await prisma.job.update({
      where: { id: parentJob.id },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // 5. Simulate dependency resolver checking dependencies
    const deps = await prisma.jobDependency.findMany({
      where: { parentJobId: parentJob.id },
      include: {
        childJob: {
          include: {
            parentDependencies: {
              include: { parentJob: true },
            },
          },
        },
      },
    });

    for (const dep of deps) {
      const child = dep.childJob;
      const allCompleted = child.parentDependencies.every(
        (p) => p.parentJob.status === JobStatus.COMPLETED
      );
      if (allCompleted) {
        await prisma.job.update({
          where: { id: child.id },
          data: { status: JobStatus.QUEUED, runAt: new Date() },
        });
      }
    }

    // 6. Assert child is now unblocked to QUEUED
    const unblockedChild = await prisma.job.findUnique({ where: { id: childJob.id } });
    expect(unblockedChild?.status).toBe(JobStatus.QUEUED);
  });
});
