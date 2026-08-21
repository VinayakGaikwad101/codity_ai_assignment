import { RetryStrategy } from '@scheduler/shared';

export interface RetryPolicyConfig {
  strategy: RetryStrategy;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export class RetryEngine {
  /**
   * Calculates the next execution timestamp for a job based on its retry policy.
   */
  static calculateNextRunAt(
    attemptNumber: number,
    policy?: Partial<RetryPolicyConfig> | null
  ): Date {
    const strategy = policy?.strategy || RetryStrategy.EXPONENTIAL;
    const baseDelayMs = policy?.baseDelayMs ?? 2000;
    const maxDelayMs = policy?.maxDelayMs ?? 60000;
    const useJitter = policy?.jitter ?? true;

    let delayMs = baseDelayMs;

    switch (strategy) {
      case RetryStrategy.FIXED:
        delayMs = baseDelayMs;
        break;

      case RetryStrategy.LINEAR:
        delayMs = baseDelayMs * attemptNumber;
        break;

      case RetryStrategy.EXPONENTIAL:
      default:
        // Exponential backoff: base * 2^(attempt - 1)
        delayMs = baseDelayMs * Math.pow(2, Math.max(0, attemptNumber - 1));
        break;
    }

    // Cap at maximum configured delay
    delayMs = Math.min(delayMs, maxDelayMs);

    // Apply Full Jitter: random between 0 and calculated delay to prevent thundering herds
    if (useJitter) {
      delayMs = Math.floor(Math.random() * delayMs);
      // Ensure minimum delay of 200ms
      delayMs = Math.max(200, delayMs);
    }

    return new Date(Date.now() + delayMs);
  }
}
