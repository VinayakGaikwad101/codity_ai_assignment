import { prisma } from '../lib/prisma.js';
import { registry } from '../handlers/handler.registry.js';
import { ClaimedJobRecord } from './poller.js';
import { JobStatus, RetryStrategy, ExecutionStatus, LogLevel } from '@scheduler/shared';

export class Executor {
  /**
   * Executes a single claimed job
   */
  static async execute(job: ClaimedJobRecord, workerId: string): Promise<void> {
    const startTime = Date.now();

    // 1. Calculate monotonic attempt number based on existing execution records in database
    const existingExecutionsCount = await prisma.jobExecution.count({
      where: { jobId: job.id },
    });
    const currentAttempt = existingExecutionsCount + 1;

    // 2. Transition Job to RUNNING and create JobExecution record
    const execution = await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      return tx.jobExecution.create({
        data: {
          jobId: job.id,
          workerId,
          attemptNumber: currentAttempt,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(),
        },
      });
    });

    const log = async (level: LogLevel | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string) => {
      try {
        await prisma.jobLog.create({
          data: {
            jobId: job.id,
            executionId: execution.id,
            level: level as LogLevel,
            message,
          },
        });
      } catch (err) {
        console.error('[Logging Error]:', err);
      }
    };

    try {
      await log('INFO', `Starting execution of ${job.name} (Attempt #${currentAttempt}/${job.maxRetries + 1})`);

      const handlerFn = registry.get(job.handlerType);
      if (!handlerFn) {
        throw new Error(`No registered execution handler found for type "${job.handlerType}"`);
      }

      // Execute with timeout promise race
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timed out after ${job.timeoutMs}ms`)), job.timeoutMs)
      );

      const result = await Promise.race([
        handlerFn(job.payload, {
          jobId: job.id,
          attemptNumber: currentAttempt,
          log,
        }),
        timeoutPromise,
      ]);

      const durationMs = Date.now() - startTime;
      await log('INFO', `Execution succeeded in ${durationMs}ms`);

      // 3. Mark Job & Execution as SUCCESS / COMPLETED
      await prisma.$transaction(async (tx) => {
        await tx.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.SUCCESS,
            finishedAt: new Date(),
            durationMs,
          },
        });

        await tx.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            result: result || {},
          },
        });
      });

      // 4. Resolve DAG dependencies: check if any child jobs can now be unlocked to QUEUED
      await this.resolveChildDependencies(job.id);
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error?.message || 'Unknown execution failure';
      const errorStack = error?.stack || null;

      await log('ERROR', `Job execution failed: ${errorMessage}`);

      // Record failed execution attempt
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          finishedAt: new Date(),
          durationMs,
          errorMessage,
          errorStack,
        },
      });

      // 5. Handle Retry Policy / Dead Letter Queue Routing
      await this.handleFailure(job, currentAttempt, errorMessage, errorStack);
    }
  }

  /**
   * Evaluates retry policies (Exponential/Linear/Fixed) or routes to DLQ
   */
  private static async handleFailure(
    job: ClaimedJobRecord,
    currentAttempt: number,
    errorMessage: string,
    errorStack: string | null
  ): Promise<void> {
    const hasRetriesLeft = currentAttempt <= job.maxRetries;

    if (hasRetriesLeft) {
      // Calculate next run delay from retry policy
      const delayMs = await this.calculateRetryDelay(job.retryPolicyId, currentAttempt);
      const nextRunAt = new Date(Date.now() + delayMs);

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.QUEUED,
          retryCount: currentAttempt,
          runAt: nextRunAt,
          claimedByWorkerId: null,
          claimedAt: null,
          startedAt: null,
        },
      });

      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          level: LogLevel.WARN,
          message: `Scheduled retry #${currentAttempt} in ${Math.round(delayMs / 1000)}s (at ${nextRunAt.toISOString()})`,
        },
      });
    } else {
      // Retries exhausted -> Quarantine in Dead Letter Queue (DLQ)
      await prisma.$transaction(async (tx) => {
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.DEAD_LETTERED,
            claimedByWorkerId: null,
          },
        });

        await tx.deadLetterQueueEntry.create({
          data: {
            projectId: job.projectId,
            queueId: job.queueId,
            jobId: job.id,
            failureReason: errorMessage,
            stackTrace: errorStack,
            originalPayload: job.payload || {},
            totalAttempts: currentAttempt,
          },
        });

        await tx.jobLog.create({
          data: {
            jobId: job.id,
            level: LogLevel.ERROR,
            message: `Job exhausted all retries (total attempts: ${currentAttempt}) and has been quarantined to Dead Letter Queue (DLQ)`,
          },
        });
      });
    }
  }

  private static async calculateRetryDelay(
    retryPolicyId: string | null,
    attempt: number
  ): Promise<number> {
    if (!retryPolicyId) {
      // Default: Exponential backoff (1s, 2s, 4s...)
      return Math.min(1000 * Math.pow(2, attempt - 1), 60000);
    }

    const policy = await prisma.retryPolicy.findUnique({
      where: { id: retryPolicyId },
    });

    if (!policy) {
      return 1000 * Math.pow(2, attempt - 1);
    }

    let delay: number;

    switch (policy.strategy) {
      case RetryStrategy.FIXED:
        delay = policy.initialIntervalMs;
        break;
      case RetryStrategy.LINEAR:
        delay = policy.initialIntervalMs * attempt;
        break;
      case RetryStrategy.EXPONENTIAL:
      default:
        delay = policy.initialIntervalMs * Math.pow(policy.backoffMultiplier, attempt - 1);
        break;
    }

    delay = Math.min(delay, policy.maxIntervalMs);

    // Apply Full Jitter: random between 0.75 * delay and 1.25 * delay
    if (policy.useJitter) {
      const jitterFactor = 0.75 + Math.random() * 0.5;
      delay = Math.round(delay * jitterFactor);
    }

    return delay;
  }

  /**
   * Evaluates downstream DAG child dependencies and unblocks them if all parents completed
   */
  private static async resolveChildDependencies(parentJobId: string): Promise<void> {
    const dependencies = await prisma.jobDependency.findMany({
      where: { parentJobId },
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

    for (const dep of dependencies) {
      const child = dep.childJob;
      if (child.status !== JobStatus.SCHEDULED) {
        continue;
      }

      // Check if all parent jobs for this child are now COMPLETED
      const allParentsCompleted = child.parentDependencies.every(
        (p) => p.parentJob.status === JobStatus.COMPLETED
      );

      if (allParentsCompleted) {
        await prisma.job.update({
          where: { id: child.id },
          data: {
            status: JobStatus.QUEUED,
            runAt: new Date(),
          },
        });

        await prisma.jobLog.create({
          data: {
            jobId: child.id,
            level: LogLevel.INFO,
            message: `All DAG parent dependencies satisfied. Unlocked job into active QUEUED state.`,
          },
        });
      }
    }
  }
}
