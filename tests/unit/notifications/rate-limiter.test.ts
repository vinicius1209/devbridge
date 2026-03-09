import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../../../src/notifications/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it('should allow requests within limit', () => {
    const maxPerMinute = 5;

    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed('192.168.1.1', maxPerMinute)).toBe(true);
    }
  });

  it('should deny requests exceeding limit', () => {
    const maxPerMinute = 3;

    for (let i = 0; i < 3; i++) {
      limiter.isAllowed('192.168.1.1', maxPerMinute);
    }

    expect(limiter.isAllowed('192.168.1.1', maxPerMinute)).toBe(false);
  });

  it('should track IPs independently', () => {
    const maxPerMinute = 2;

    limiter.isAllowed('192.168.1.1', maxPerMinute);
    limiter.isAllowed('192.168.1.1', maxPerMinute);

    // IP 1 should be at limit
    expect(limiter.isAllowed('192.168.1.1', maxPerMinute)).toBe(false);

    // IP 2 should still have capacity
    expect(limiter.isAllowed('192.168.1.2', maxPerMinute)).toBe(true);
  });

  it('should allow requests after window expires', () => {
    vi.useFakeTimers();

    const maxPerMinute = 2;

    limiter.isAllowed('192.168.1.1', maxPerMinute);
    limiter.isAllowed('192.168.1.1', maxPerMinute);

    expect(limiter.isAllowed('192.168.1.1', maxPerMinute)).toBe(false);

    // Advance past the 1 minute window
    vi.advanceTimersByTime(61 * 1000);

    expect(limiter.isAllowed('192.168.1.1', maxPerMinute)).toBe(true);

    vi.useRealTimers();
  });

  it('should handle first request from new IP', () => {
    expect(limiter.isAllowed('10.0.0.1', 100)).toBe(true);
  });
});
