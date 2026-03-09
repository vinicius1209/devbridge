import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationFilter } from '../../../src/notifications/filters.js';
import type { NotificationConfig } from '../../../src/notifications/types.js';

describe('NotificationFilter', () => {
  let filter: NotificationFilter;
  let config: NotificationConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      port: 9876,
      github_events: ['push', 'pull_request', 'issues'],
      watched_branches: ['main', 'develop'],
      rate_limit: { max_per_minute: 30, cooldown_seconds: 5 },
    };
    filter = new NotificationFilter(config);
  });

  describe('shouldNotify', () => {
    it('should return true for configured event type', () => {
      const result = filter.shouldNotify('push', {
        ref: 'refs/heads/main',
      });

      expect(result).toBe(true);
    });

    it('should return false for unconfigured event type', () => {
      const result = filter.shouldNotify('star', {});

      expect(result).toBe(false);
    });

    it('should filter push events by watched branches', () => {
      const mainPush = filter.shouldNotify('push', { ref: 'refs/heads/main' });
      const featurePush = filter.shouldNotify('push', { ref: 'refs/heads/feature/xyz' });

      expect(mainPush).toBe(true);
      expect(featurePush).toBe(false);
    });

    it('should support event.action format', () => {
      const configWithActions: NotificationConfig = {
        ...config,
        github_events: ['pull_request.opened'],
      };
      const filterWithActions = new NotificationFilter(configWithActions);

      const opened = filterWithActions.shouldNotify('pull_request', { action: 'opened' });
      expect(opened).toBe(true);
    });

    it('should return false when muted', () => {
      filter.mute(60);

      const result = filter.shouldNotify('push', { ref: 'refs/heads/main' });
      expect(result).toBe(false);
    });

    it('should return false when notifications are disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledFilter = new NotificationFilter(disabledConfig);

      const result = disabledFilter.shouldNotify('push', { ref: 'refs/heads/main' });
      expect(result).toBe(false);
    });

    it('should match base event type even when action is present', () => {
      // 'pull_request' is in the list, and event has action 'opened'
      const result = filter.shouldNotify('pull_request', { action: 'opened' });
      expect(result).toBe(true);
    });
  });

  describe('mute / unmute', () => {
    it('should mute notifications for specified minutes', () => {
      filter.mute(30);
      expect(filter.isMuted()).toBe(true);
    });

    it('should unmute notifications', () => {
      filter.mute(30);
      filter.unmute();
      expect(filter.isMuted()).toBe(false);
    });

    it('should auto-unmute after expiry', () => {
      filter.mute(0); // 0 minutes = already expired

      // Need to let the Date.now() be ahead of mutedUntil
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      expect(filter.isMuted()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('isMuted', () => {
    it('should return false when not muted', () => {
      expect(filter.isMuted()).toBe(false);
    });

    it('should return true when muted and not expired', () => {
      filter.mute(60);
      expect(filter.isMuted()).toBe(true);
    });

    it('should return false after mute expires', () => {
      vi.useFakeTimers();
      filter.mute(1); // 1 minute
      vi.advanceTimersByTime(2 * 60 * 1000); // Advance 2 minutes

      expect(filter.isMuted()).toBe(false);

      vi.useRealTimers();
    });
  });
});
