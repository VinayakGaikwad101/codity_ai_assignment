import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export interface ClaimedJobWithMeta {
  id: string;
  projectId: string;
  queueId: string;
  name: string;
  handlerType: string;
  jobType: string;
  status: string;
  priority: number;
  payload: any;
  runAt: Date;
  timeoutMs: number;
  maxRetries: number;
  retryCount: number;
  retryPolicyId?: string | null;
  parentJobId?: string | null;
  scheduledJobId?: string | null;
  claimedByWorkerId?: string | null;
  claimedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class JobPoller {
  /**
   * Atomically claims up to `limit` ready jobs using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`.
   * Also verifies that DAG parent dependencies (if any) are fully COMPLETED before claiming.
   */
  static async claimJobs(
    workerId: string,
    limit: number,
    queueId?: string
  ): Promise<ClaimedJobWithMeta[]> {
    if (limit <= 0) return [];

    try {
      return await prisma.$transaction(async (tx) => {
        // Step 1: Atomic query with SKIP LOCKED
        const claimedRows: { id: string }[] = await tx.$queryRaw`
          SELECT j.id
          FROM jobs j
          JOIN queues q ON j.queue_id = q.id
          WHERE q.is_paused = FALSE
            AND j.status IN ('QUEUED', 'SCHEDULED')
            AND j.run_at <= NOW()
            AND (${queueId ? Prisma.sql`j.queue_id = ${queueId}::uuid` : Prisma.sql`TRUE`})
            AND (
              NOT EXISTS (
                SELECT 1
                FROM job_dependencies jd
                JOIN jobs pj ON jd.parent_job_id = pj.id
                WHERE jd.child_job_id = j.id
                  AND pj.status != 'COMPLETED'
              )
            )
          ORDER BY j.priority DESC, j.run_at ASC, j.id ASC
          LIMIT ${limit}
          FOR UPDATE OF j SKIP LOCKED;
        `;

        if (!claimedRows || claimedRows.length === 0) {
          return [];
        }

        const jobIds = claimedRows.map((r) => r.id);

        // Step 2: Mark claimed in same transaction
        await tx.$executeRaw`
          UPDATE jobs
          SET status = 'CLAIMED',
              claimed_by_worker_id = ${workerId}::uuid,
              claimed_at = NOW(),
              updated_at = NOW()
          WHERE id = ANY(${jobIds}::uuid[]);
        `;

        // Step 3: Fetch updated job records with retry policy details
        const claimedJobs = await tx.job.findMany({
          where: { id: { in: jobIds } },
          include: {
            retryPolicy: true,
            queue: true,
          },
        });

        return claimedJobs as unknown as ClaimedJobWithMeta[];
      });
    } catch (error) {
      console.error('[JobPoller] Error during atomic job claim transaction:', error);
      return [];
    }
  }
}
