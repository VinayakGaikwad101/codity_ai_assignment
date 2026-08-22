import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';

export interface AiFailureSummary {
  rootCause: string;
  category: 'NETWORK_TIMEOUT' | 'DOWNSTREAM_OUTAGE' | 'AUTHENTICATION_ERROR' | 'SCHEMA_VALIDATION' | 'RESOURCE_EXHAUSTION' | 'UNKNOWN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  recommendations: string[];
}

export class AiSummaryService {
  static async generateFailureSummary(dlqId: string, organizationId: string): Promise<AiFailureSummary> {
    const entry = await prisma.deadLetterQueueEntry.findUnique({
      where: { id: dlqId },
      include: {
        job: true,
        project: true,
      },
    });

    if (!entry || entry.project.organizationId !== organizationId) {
      throw new AppError('Quarantined DLQ entry not found', 404, 'DLQ_NOT_FOUND');
    }

    const reason = (entry.failureReason || '').toLowerCase();
    const stack = (entry.stackTrace || '').toLowerCase();
    const payload = JSON.stringify(entry.originalPayload || {});

    // Intelligent heuristic failure analysis engine
    if (reason.includes('503') || reason.includes('gateway') || stack.includes('service unavailable')) {
      return {
        rootCause: 'Downstream Service Unavailable (HTTP 503 / Gateway Outage)',
        category: 'DOWNSTREAM_OUTAGE',
        severity: 'HIGH',
        explanation: `The job "${entry.job.name}" failed after ${entry.totalAttempts} attempts because the external gateway returned HTTP 503 Service Unavailable. The target service is experiencing heavy load or undergoing maintenance.`,
        recommendations: [
          'Verify downstream payment/webhook provider operational status page.',
          'Check if downstream rate limits or circuit breakers were tripped.',
          'Trigger an atomic 1-click Replay once the external provider recovers.',
        ],
      };
    }

    if (reason.includes('timeout') || reason.includes('etimedout') || stack.includes('timeout')) {
      return {
        rootCause: 'Network Socket Timeout / Latency Spike',
        category: 'NETWORK_TIMEOUT',
        severity: 'HIGH',
        explanation: `The background task exceeded the configured timeout limit of ${entry.job.timeoutMs}ms while waiting for a network handshake.`,
        recommendations: [
          'Increase the queue task timeout limit (current: ' + entry.job.timeoutMs + 'ms) if processing large payloads.',
          'Inspect database connection pool and worker DNS resolution latency.',
          'Replay the task during off-peak hours.',
        ],
      };
    }

    if (reason.includes('unauthorized') || reason.includes('401') || reason.includes('forbidden') || reason.includes('403')) {
      return {
        rootCause: 'Authentication or Token Expiry Failure',
        category: 'AUTHENTICATION_ERROR',
        severity: 'CRITICAL',
        explanation: 'The worker encountered an HTTP 401/403 authorization rejection. API credentials, bearer tokens, or machine keys may have expired.',
        recommendations: [
          'Rotate the API Key in the API Keys & Access module.',
          'Verify that environment credentials have not been revoked.',
          'Update payload credentials before replaying.',
        ],
      };
    }

    if (reason.includes('syntax') || reason.includes('validation') || reason.includes('json') || payload.includes('invalid')) {
      return {
        rootCause: 'Schema Validation or Payload Malformation',
        category: 'SCHEMA_VALIDATION',
        severity: 'MEDIUM',
        explanation: 'The worker failed while parsing or validating the incoming JSON payload schema against expected task handler parameters.',
        recommendations: [
          'Inspect the original JSON payload in the details panel for missing required keys.',
          'Ensure the upstream producer adheres to the handler DTO contract.',
        ],
      };
    }

    // General fallback diagnosis
    return {
      rootCause: `Unhandled Exception: ${entry.failureReason.substring(0, 80)}`,
      category: 'UNKNOWN',
      severity: 'MEDIUM',
      explanation: `Job failed repeatedly and exhausted all ${entry.totalAttempts} configured retry attempts. An unhandled exception was thrown during handler execution.`,
      recommendations: [
        'Inspect the raw stack trace in the error drawer below.',
        'Review recent worker code changes to handler: ' + entry.job.handlerType + '.',
        'Test the handler locally with identical payload parameters before replaying.',
      ],
    };
  }
}
