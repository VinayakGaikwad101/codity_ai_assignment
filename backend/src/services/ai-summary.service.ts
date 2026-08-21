import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

export class AiSummaryService {
  /**
   * Generates a diagnostic root-cause summary and fix recommendations for a failed or dead-lettered job.
   */
  static async generateFailureSummary(jobId: string, organizationId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        project: true,
        queue: true,
        executions: {
          orderBy: { attemptNumber: 'desc' },
          take: 5,
        },
        jobLogs: {
          where: { level: { in: ['ERROR', 'WARN'] } },
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        dlqEntries: true,
      },
    });

    if (!job || job.project.organizationId !== organizationId) {
      throw new AppError('Job not found in your organization', 404, 'JOB_NOT_FOUND');
    }

    const latestExecution = job.executions[0];
    const errorMessage = latestExecution?.errorMessage || job.dlqEntries[0]?.failureReason || 'Unknown error';
    const errorStack = latestExecution?.errorStack || '';
    const logs = job.jobLogs.map((l) => `[${l.level}] ${l.message}`).join('\n');

    // Rule-based diagnostic classifier simulating LLM failure analysis
    let rootCauseCategory = 'APPLICATION_RUNTIME_EXCEPTION';
    let summary = `Job "${job.name}" encountered repeated execution failures during processing.`;
    const suggestedActions: string[] = [];

    if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
      rootCauseCategory = 'TIMEOUT_EXCEEDED';
      summary = `The handler exceeded its allotted execution timeout threshold (${job.timeoutMs}ms). The task was forcefully terminated to prevent worker starvation.`;
      suggestedActions.push('Increase the job timeout threshold in the queue configuration');
      suggestedActions.push('Optimize payload batch sizes to reduce execution latency');
      suggestedActions.push('Check downstream API response times and network latency');
    } else if (errorMessage.toLowerCase().includes('dead') || errorMessage.toLowerCase().includes('reaper')) {
      rootCauseCategory = 'WORKER_CRASH_OR_UNRESPONSIVE';
      summary = 'The worker process executing this job stopped emitting heartbeats and was declared DEAD by the Reaper daemon.';
      suggestedActions.push('Inspect worker host memory usage for OOM (Out-Of-Memory) kills');
      suggestedActions.push('Scale up worker concurrency slots or allocate additional worker containers');
    } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('econnrefused')) {
      rootCauseCategory = 'NETWORK_CONNECTIVITY_FAILURE';
      summary = 'Failed to establish connection with external HTTP endpoint or webhook target.';
      suggestedActions.push('Verify target endpoint DNS and server availability');
      suggestedActions.push('Ensure firewall / security group allows outbound HTTP/HTTPS egress');
    } else {
      suggestedActions.push('Inspect payload JSON schema for malformed arguments');
      suggestedActions.push('Check recent code deployments for uncaught exception handling');
    }

    return {
      jobId: job.id,
      jobName: job.name,
      status: job.status,
      attemptsExhausted: job.retryCount,
      rootCauseCategory,
      summary,
      rawError: errorMessage,
      recentErrorLogs: logs || 'No explicit error logs recorded.',
      suggestedActions,
      analyzedAt: new Date().toISOString(),
    };
  }
}
