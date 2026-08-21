import { prisma } from '../lib/prisma.js';
import { RetryEngine } from './retry.engine.js';
import {
  ExecutionStatus,
  JobHandlerType,
  JobStatus,
  LogLevel,
} from '@scheduler/shared';

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  stack?: string;
}

export class JobExecutor {
  /**
   * Executes a claimed job, tracks execution lifecycle, captures logs, handles timeouts, and routes to retries or DLQ.
   */
  static async executeJob(workerId: string, job: any): Promise<void> {
    const startTime = Date.now();
    const attemptNumber = (job.retryCount || 0) + 1;

    // Step 1: Transition Job to RUNNING and create JobExecution record
    const [execution] = await prisma.$transaction([
      prisma.jobExecution.create({
        data: {
          jobId: job.id,
          attemptNumber,
          workerId,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(),
        },
      }),
      prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.RUNNING,
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ]);

    const logEmitter = async (level: LogLevel, message: string, metadata?: any) => {
      try {
        await prisma.jobLog.create({
          data: {
            jobId: job.id,
            jobExecutionId: execution.id,
            level,
            message,
            metadata: metadata || null,
          },
        });
      } catch (err) {
        console.error('[JobExecutor] Failed to write job log:', err);
      }
    };

    await logEmitter(LogLevel.INFO, `Execution attempt #${attemptNumber} started by worker ${workerId}`);

    // Step 2: Execute handler with timeout promise race
    let result: ExecutionResult;
    try {
      const timeoutMs = job.timeoutMs || 60000;
      result = await Promise.race([
        this.runHandler(job, logEmitter),
        this.createTimeoutPromise(timeoutMs),
      ]);
    } catch (err: any) {
      result = {
        success: false,
        error: err.message || 'Execution error',
        stack: err.stack,
      };
    }

    const durationMs = Date.now() - startTime;
    const completedAt = new Date();

    // Step 3: Handle Success
    if (result.success) {
      await logEmitter(LogLevel.INFO, `Job finished successfully in ${durationMs}ms`, { result: result.data });

      await prisma.$transaction([
        prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.SUCCESS,
            completedAt,
            durationMs,
          },
        }),
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.COMPLETED,
            completedAt,
            result: result.data || {},
            claimedByWorkerId: null,
            updatedAt: new Date(),
          },
        }),
      ]);

      return;
    }

    // Step 4: Handle Failure & Retries / DLQ
    const errorMessage = result.error || 'Unknown execution failure';
    const errorStack = result.stack;

    await logEmitter(LogLevel.ERROR, `Execution attempt #${attemptNumber} failed: ${errorMessage}`, {
      stack: errorStack,
      durationMs,
    });

    const isTimedOut = errorMessage.includes('Execution timed out');
    const newRetryCount = job.retryCount + 1;
    const maxRetries = job.maxRetries ?? 3;

    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: isTimedOut ? ExecutionStatus.TIMED_OUT : ExecutionStatus.FAILED,
        completedAt,
        durationMs,
        errorMessage,
        errorStack,
      },
    });

    // Check if retries remain
    if (newRetryCount < maxRetries) {
      const nextRunAt = RetryEngine.calculateNextRunAt(newRetryCount, job.retryPolicy);

      await logEmitter(
        LogLevel.WARN,
        `Retrying job (attempt ${newRetryCount}/${maxRetries}) scheduled at ${nextRunAt.toISOString()}`
      );

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.SCHEDULED,
          retryCount: newRetryCount,
          runAt: nextRunAt,
          claimedByWorkerId: null,
          claimedAt: null,
          startedAt: null,
          updatedAt: new Date(),
        },
      });
    } else {
      // Retries exhausted -> Route to Dead Letter Queue (DLQ)
      await logEmitter(
        LogLevel.ERROR,
        `Max retries (${maxRetries}) exhausted. Job routed to Dead Letter Queue (DLQ).`
      );

      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.DEAD_LETTERED,
            retryCount: newRetryCount,
            claimedByWorkerId: null,
            updatedAt: new Date(),
          },
        }),
        prisma.deadLetterQueueEntry.create({
          data: {
            jobId: job.id,
            queueId: job.queueId,
            projectId: job.projectId,
            originalPayload: job.payload || {},
            failureReason: errorMessage,
            errorDetails: {
              stack: errorStack,
              attemptNumber: newRetryCount,
              durationMs,
            },
            totalAttempts: newRetryCount,
          },
        }),
      ]);
    }
  }

  private static async runHandler(
    job: any,
    log: (level: LogLevel, msg: string, meta?: any) => Promise<void>
  ): Promise<ExecutionResult> {
    const payload = job.payload || {};
    const handlerType = job.handlerType;

    switch (handlerType) {
      case JobHandlerType.SAMPLE_EMAIL: {
        await log(LogLevel.INFO, `Sending email to recipient: ${payload.recipient || 'unknown@example.com'}`);
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulated network latency
        return {
          success: true,
          data: { sent: true, recipient: payload.recipient, messageId: `msg_${Date.now()}` },
        };
      }

      case JobHandlerType.SAMPLE_REPORT: {
        await log(LogLevel.INFO, `Compiling analytics report for period: ${payload.period || 'daily'}`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return {
          success: true,
          data: { reportUrl: `https://storage.acme.internal/reports/${job.id}.pdf`, rowsProcessed: 4500 },
        };
      }

      case JobHandlerType.HTTP_WEBHOOK: {
        const endpoint = payload.endpoint || payload.url;
        if (!endpoint) {
          throw new Error('HTTP webhook requires "endpoint" or "url" in payload');
        }
        await log(LogLevel.INFO, `Dispatching HTTP POST to ${endpoint}`);
        // Simulate HTTP dispatch or use fetch
        await new Promise((resolve) => setTimeout(resolve, 600));
        return {
          success: true,
          data: { statusCode: 200, statusText: 'OK', deliveredAt: new Date().toISOString() },
        };
      }

      case JobHandlerType.CUSTOM_COMPUTE:
      default: {
        await log(LogLevel.INFO, `Executing compute job: ${job.name}`);
        // If payload explicitly requests failure (for testing retry / DLQ behavior)
        if (payload.shouldFail === true) {
          throw new Error(payload.failureMessage || 'Intentional simulation failure triggered by payload');
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
          success: true,
          data: { processed: true, itemsCount: payload.itemsCount || 1, timestamp: new Date().toISOString() },
        };
      }
    }
  }

  private static createTimeoutPromise(timeoutMs: number): Promise<ExecutionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}
