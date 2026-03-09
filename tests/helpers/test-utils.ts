import type { DevBridgeConfig, Session } from '../../src/types.js';

export function createMockConfig(overrides: Partial<DevBridgeConfig> = {}): DevBridgeConfig {
  return {
    telegram: {
      bot_token: 'test-token:ABC123',
      allowed_users: ['12345'],
    },
    projects: {
      'test-project': {
        path: '/tmp/test-project',
        adapter: 'claude',
        model: 'sonnet',
        description: 'Test project',
      },
    },
    commands: {
      test: 'yarn test',
      lint: 'yarn lint',
    },
    defaults: {
      adapter: 'claude',
      model: 'sonnet',
      timeout: 120,
      max_message_length: 4096,
      session_ttl_hours: 24,
      command_timeout: 60,
    },
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-123',
    projectName: 'test-project',
    projectPath: '/tmp/test-project',
    adapter: 'claude',
    cliSessionId: 'cli-session-123',
    messageCount: 5,
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockNotificationConfig() {
  return {
    enabled: true,
    port: 9876,
    secret: 'test-secret',
    github_events: ['push', 'pull_request', 'issues', 'workflow_run'],
    watched_branches: ['main', 'master', 'develop'],
    rate_limit: {
      max_per_minute: 30,
      cooldown_seconds: 5,
    },
  };
}
