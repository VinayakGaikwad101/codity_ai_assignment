import { describe, it, expect } from 'vitest';
import { CronExpressionParser } from 'cron-parser';

describe('Cron Parser Unit Tests', () => {
  it('should accurately calculate next run for hourly cron', () => {
    const interval = CronExpressionParser.parse('0 * * * *', { tz: 'UTC' });
    const nextDate = interval.next().toDate();

    expect(nextDate.getUTCMinutes()).toBe(0);
    expect(nextDate.getUTCSeconds()).toBe(0);
    expect(nextDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('should accurately calculate next run for daily midnight cron', () => {
    const interval = CronExpressionParser.parse('0 0 * * *', { tz: 'UTC' });
    const nextDate = interval.next().toDate();

    expect(nextDate.getUTCHours()).toBe(0);
    expect(nextDate.getUTCMinutes()).toBe(0);
    expect(nextDate.getUTCSeconds()).toBe(0);
    expect(nextDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('should support custom timezone calculations', () => {
    const intervalUTC = CronExpressionParser.parse('0 12 * * *', { tz: 'UTC' });
    const intervalIST = CronExpressionParser.parse('0 12 * * *', { tz: 'Asia/Kolkata' });

    const nextUTC = intervalUTC.next().toDate();
    const nextIST = intervalIST.next().toDate();

    expect(nextUTC).toBeInstanceOf(Date);
    expect(nextIST).toBeInstanceOf(Date);
  });
});
