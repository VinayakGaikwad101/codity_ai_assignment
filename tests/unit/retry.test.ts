import { describe, it, expect } from 'vitest';
import { RetryEngine } from '../../worker/src/engine/retry.engine.js';
import { RetryStrategy } from '@scheduler/shared';

describe('RetryEngine Unit Tests', () => {
  it('should calculate fixed delay without jitter accurately', () => {
    const policy = {
      strategy: RetryStrategy.FIXED,
      maxRetries: 3,
      baseDelayMs: 5000,
      maxDelayMs: 60000,
      jitter: false,
    };

    const before = Date.now();
    const nextRun = RetryEngine.calculateNextRunAt(1, policy);
    const delay = nextRun.getTime() - before;

    expect(delay).toBeGreaterThanOrEqual(4900);
    expect(delay).toBeLessThanOrEqual(5100);
  });

  it('should calculate linear backoff without jitter accurately', () => {
    const policy = {
      strategy: RetryStrategy.LINEAR,
      maxRetries: 5,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      jitter: false,
    };

    // Attempt 3 => 2000 * 3 = 6000ms
    const before = Date.now();
    const nextRun = RetryEngine.calculateNextRunAt(3, policy);
    const delay = nextRun.getTime() - before;

    expect(delay).toBeGreaterThanOrEqual(5900);
    expect(delay).toBeLessThanOrEqual(6100);
  });

  it('should calculate exponential backoff without jitter accurately', () => {
    const policy = {
      strategy: RetryStrategy.EXPONENTIAL,
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      jitter: false,
    };

    // Attempt 1 => 1000 * 2^0 = 1000ms
    const nextRun1 = RetryEngine.calculateNextRunAt(1, policy);
    const delay1 = nextRun1.getTime() - Date.now();
    expect(delay1).toBeGreaterThanOrEqual(900);
    expect(delay1).toBeLessThanOrEqual(1100);

    // Attempt 4 => 1000 * 2^3 = 8000ms
    const nextRun4 = RetryEngine.calculateNextRunAt(4, policy);
    const delay4 = nextRun4.getTime() - Date.now();
    expect(delay4).toBeGreaterThanOrEqual(7900);
    expect(delay4).toBeLessThanOrEqual(8100);
  });

  it('should cap delay at maxDelayMs', () => {
    const policy = {
      strategy: RetryStrategy.EXPONENTIAL,
      maxRetries: 10,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      jitter: false,
    };

    // Attempt 10 => 1000 * 2^9 = 512,000ms capped to 10,000ms
    const nextRun = RetryEngine.calculateNextRunAt(10, policy);
    const delay = nextRun.getTime() - Date.now();

    expect(delay).toBeLessThanOrEqual(10100);
  });

  it('should keep jittered delay within valid lower and upper bounds', () => {
    const policy = {
      strategy: RetryStrategy.EXPONENTIAL,
      maxRetries: 3,
      baseDelayMs: 4000,
      maxDelayMs: 60000,
      jitter: true,
    };

    for (let i = 0; i < 20; i++) {
      const nextRun = RetryEngine.calculateNextRunAt(2, policy);
      const delay = nextRun.getTime() - Date.now();

      // Lower bound is minimum 200ms, upper bound is 4000 * 2^1 = 8000ms
      expect(delay).toBeGreaterThanOrEqual(190);
      expect(delay).toBeLessThanOrEqual(8100);
    }
  });
});
