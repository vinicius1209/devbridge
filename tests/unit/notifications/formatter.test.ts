import { describe, it, expect } from 'vitest';
import { formatGeneric, formatGitHubEvent, formatCI } from '../../../src/notifications/formatter.js';
import pushPayload from '../../fixtures/github-payloads/push.json';
import prPayload from '../../fixtures/github-payloads/pull-request.json';

describe('Notification Formatter', () => {
  describe('formatGeneric', () => {
    it('should format info notification', () => {
      const result = formatGeneric({
        title: 'Test Alert',
        message: 'Something happened',
        level: 'info',
      });

      expect(result).toContain('Test Alert');
      expect(result).toContain('Something happened');
    });

    it('should format success notification', () => {
      const result = formatGeneric({
        title: 'Deploy Complete',
        message: 'v1.2.3 deployed',
        level: 'success',
      });

      expect(result).toContain('Deploy Complete');
      expect(result).toContain('v1.2.3 deployed');
    });

    it('should format error notification', () => {
      const result = formatGeneric({
        title: 'Error',
        message: 'Failed to process',
        level: 'error',
      });

      expect(result).toContain('Error');
      expect(result).toContain('Failed to process');
    });

    it('should format warning notification', () => {
      const result = formatGeneric({
        title: 'Warning',
        message: 'Disk space low',
        level: 'warning',
      });

      expect(result).toContain('Warning');
    });

    it('should include project name when provided', () => {
      const result = formatGeneric({
        title: 'Alert',
        message: 'msg',
        project: 'my-app',
      });

      expect(result).toContain('[my-app]');
    });

    it('should default to info level', () => {
      const result = formatGeneric({
        title: 'Alert',
        message: 'msg',
      });

      // Default level is info, which uses the info emoji
      expect(result).toBeDefined();
      expect(result).toContain('Alert');
    });
  });

  describe('formatGitHubEvent', () => {
    it('should format push event', () => {
      const result = formatGitHubEvent('push', pushPayload as any);

      expect(result).not.toBeNull();
      expect(result).toContain('my-app');
      expect(result).toContain('main');
      expect(result).toContain('johndoe');
      expect(result).toContain('abc1234');
      expect(result).toContain('feat: add new feature');
    });

    it('should format pull_request opened event', () => {
      const result = formatGitHubEvent('pull_request', prPayload as any);

      expect(result).not.toBeNull();
      expect(result).toContain('#42');
      expect(result).toContain('implement new API endpoint');
      expect(result).toContain('johndoe');
      expect(result).toContain('feature/new-endpoint');
      expect(result).toContain('main');
    });

    it('should format pull_request closed (merged) event', () => {
      const payload = {
        ...prPayload,
        action: 'closed',
        pull_request: { ...prPayload.pull_request, merged: true },
      };

      const result = formatGitHubEvent('pull_request', payload as any);

      expect(result).toContain('mergeado');
    });

    it('should format pull_request closed (not merged) event', () => {
      const payload = {
        ...prPayload,
        action: 'closed',
        pull_request: { ...prPayload.pull_request, merged: false },
      };

      const result = formatGitHubEvent('pull_request', payload as any);

      expect(result).toContain('fechado');
    });

    it('should format issues event', () => {
      const payload = {
        action: 'opened',
        repository: { name: 'my-app' },
        issue: {
          number: 10,
          title: 'Bug report',
          user: { login: 'tester' },
          labels: [{ name: 'bug' }],
        },
      };

      const result = formatGitHubEvent('issues', payload as any);

      expect(result).toContain('#10');
      expect(result).toContain('Bug report');
      expect(result).toContain('tester');
      expect(result).toContain('bug');
    });

    it('should format workflow_run event', () => {
      const payload = {
        repository: { name: 'my-app' },
        workflow_run: {
          name: 'CI Pipeline',
          conclusion: 'success',
          head_branch: 'main',
          html_url: 'https://github.com/user/my-app/actions/runs/123',
        },
      };

      const result = formatGitHubEvent('workflow_run', payload as any);

      expect(result).toContain('CI Pipeline');
      expect(result).toContain('success');
      expect(result).toContain('main');
    });

    it('should format check_run event', () => {
      const payload = {
        repository: { name: 'my-app' },
        check_run: {
          name: 'lint',
          conclusion: 'failure',
        },
      };

      const result = formatGitHubEvent('check_run', payload as any);

      expect(result).toContain('lint');
      expect(result).toContain('failure');
    });

    it('should format pull_request_review event', () => {
      const payload = {
        repository: { name: 'my-app' },
        review: {
          state: 'approved',
          user: { login: 'reviewer' },
        },
        pull_request: { number: 42 },
      };

      const result = formatGitHubEvent('pull_request_review', payload as any);

      expect(result).toContain('#42');
      expect(result).toContain('reviewer');
      expect(result).toContain('approved');
    });

    it('should return generic message for unknown event types', () => {
      const result = formatGitHubEvent('unknown_event', {} as any);

      expect(result).toContain('unknown_event');
    });

    it('should truncate push commits to 10', () => {
      const commits = Array.from({ length: 15 }, (_, i) => ({
        id: `commit-${i}`,
        message: `commit message ${i}`,
      }));

      const payload = {
        ref: 'refs/heads/main',
        repository: { name: 'big-repo' },
        pusher: { name: 'dev' },
        commits,
      };

      const result = formatGitHubEvent('push', payload as any);

      expect(result).toContain('e mais 5 commits');
    });
  });

  describe('formatCI', () => {
    it('should format CI success notification', () => {
      const result = formatCI({
        status: 'success',
        pipeline: 'build-and-test',
        project: 'my-app',
        duration: '2m 30s',
        url: 'https://ci.example.com/build/123',
      });

      expect(result).toContain('success');
      expect(result).toContain('build-and-test');
      expect(result).toContain('[my-app]');
      expect(result).toContain('2m 30s');
      expect(result).toContain('https://ci.example.com/build/123');
    });

    it('should format CI failure notification', () => {
      const result = formatCI({
        status: 'failure',
        pipeline: 'deploy',
      });

      expect(result).toContain('failure');
      expect(result).toContain('deploy');
    });

    it('should omit optional fields when not present', () => {
      const result = formatCI({
        status: 'success',
        pipeline: 'test',
      });

      expect(result).not.toContain('Duracao');
      expect(result).not.toContain('Detalhes');
    });
  });
});
