import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, JobStatus, WorkerStatus } from '@prisma/client';
import { JobPoller } from '../../worker/src/engine/poller.js';

const prisma = new PrismaClient();

describe('Concurrency & Atomic Claim Stress Tests', () => {
  let testProjectId: string;
  let testQueueId: string;
  const workerIds: string[] = [];

  beforeAll(async () => {
    // 1. Create dedicated organization & project for concurrency testing
    const org = await prisma.organization.create({
      data: {
        name: 'Concurrency Test Org',
        slug: `test-concurrency-${Date.now()}`,
      },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Concurrency Project',
        slug: `concurrency-project-${Date.now()}`,
      },
    });
    testProjectId = project.id;

    const queue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: 'stress-queue',
        priority: 50,
        concurrencyLimit: 20,
      },
    });
    testQueueId = queue.id;

    // 2. Register 5 distinct worker nodes
    for (let i = 1; i <= 5; i++) {
      const worker = await prisma.worker.create({
        data: {
          hostname: `test-node-${i}`,
          concurrencyLimit: 10,
          status: WorkerStatus.HEALTHY,
        },
      });
      workerIds.push(worker.id);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testProjectId) {
      await prisma.project.delete({ where: { id: testProjectId } });
    }
    await prisma.$disconnect();
  });

  it('should claim all 50 jobs with zero duplicate claims across 5 concurrent workers', async () => {
    const totalJobs = 50;

    // Seed 50 queued jobs
    const jobsData = Array.from({ length: totalJobs }).map((_, idx) => ({
      projectId: testProjectId,
      queueId: testQueueId,
      name: `Concurrent Job #${idx + 1}`,
      status: JobStatus.QUEUED,
      priority: Math.floor(Math.random() * 100),
      payload: { index: idx },
      runAt: new Date(),
    }));

    await prisma.job.createMany({ data: jobsData });

    // Simulate concurrent workers claiming jobs simultaneously across multiple rounds
    const allClaimedJobIds: string[] = [];

    while (allClaimedJobIds.length < totalJobs) {
      const roundPromises = workerIds.map(async (wId) => {
        const claims = await JobPoller.claimJobs(wId, 10, testQueueId);
        return claims.map((c) => c.id);
      });

      const roundResults = await Promise.all(roundPromises);
      let newClaimsInRound = 0;

      for (const list of roundResults) {
        allClaimedJobIds.push(...list);
        newClaimsInRound += list.length;
      }

      if (newClaimsInRound === 0) break;
    }

    // Verify:
    // 1. Total claimed count equals the sum of claimed jobs
    expect(allClaimedJobIds.length).toBe(totalJobs);

    // 2. Exactly 0 duplicates (Set size must equal array length)
    const uniqueClaimedIds = new Set(allClaimedJobIds);
    expect(uniqueClaimedIds.size).toBe(totalJobs);

    // 3. Database status verification: all jobs must be CLAIMED
    const claimedInDb = await prisma.job.count({
      where: {
        queueId: testQueueId,
        status: JobStatus.CLAIMED,
      },
    });
    expect(claimedInDb).toBe(totalJobs);
  });
});
