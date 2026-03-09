import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// Mock modules before importing
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

describe('loadConfig', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  async function loadConfigFresh() {
    const mod = await import('../../src/config.js');
    return mod.loadConfig;
  }

  it('should exit if config file does not exist', async () => {
    mockedExistsSync.mockReturnValue(false);

    const loadConfig = await loadConfigFresh();

    expect(() => loadConfig()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Config file not found'));
  });

  it('should exit if bot_token is missing', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { allowed_users: ['123'] },
      projects: { test: { path: '/tmp', adapter: 'claude' } },
    }));

    const loadConfig = await loadConfigFresh();

    expect(() => loadConfig()).toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('bot_token is required'));
  });

  it('should exit if allowed_users is empty', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: [] },
      projects: { test: { path: '/tmp', adapter: 'claude' } },
    }));

    const loadConfig = await loadConfigFresh();

    expect(() => loadConfig()).toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('allowed_users'));
  });

  it('should exit if no projects configured', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: ['123'] },
    }));

    const loadConfig = await loadConfigFresh();

    expect(() => loadConfig()).toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('at least one project'));
  });

  it('should load valid config with projects', async () => {
    // For project path validation, existsSync needs to return true
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: ['123'] },
      projects: {
        'my-app': { path: '/tmp/my-app', adapter: 'claude', model: 'sonnet', description: 'Test' },
      },
      commands: { test: 'yarn test' },
      defaults: {
        adapter: 'claude',
        timeout: 60,
      },
    }));

    const loadConfig = await loadConfigFresh();
    const config = loadConfig();

    expect(config.telegram.bot_token).toBe('test-token:ABC');
    expect(config.telegram.allowed_users).toEqual(['123']);
    expect(config.projects['my-app']).toBeDefined();
    expect(config.projects['my-app'].adapter).toBe('claude');
    expect(config.projects['my-app'].model).toBe('sonnet');
    expect(config.projects['my-app'].description).toBe('Test');
    expect(config.commands.test).toBe('yarn test');
    expect(config.defaults.timeout).toBe(60);
    expect(config.defaults.max_message_length).toBe(4096);
    expect(config.defaults.session_ttl_hours).toBe(24);
    expect(config.defaults.command_timeout).toBe(60);
  });

  it('should handle v0.1 compat - migrate project (singular) to projects (plural)', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: ['123'] },
      project: {
        name: 'legacy-app',
        path: '/tmp/legacy',
        adapter: 'claude',
        model: 'opus',
      },
    }));

    const loadConfig = await loadConfigFresh();
    const config = loadConfig();

    expect(config.projects['legacy-app']).toBeDefined();
    expect(config.projects['legacy-app'].adapter).toBe('claude');
    expect(config.projects['legacy-app'].model).toBe('opus');
  });

  it('should parse notifications config with defaults', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: ['123'] },
      projects: { app: { path: '/tmp/app', adapter: 'claude' } },
      notifications: {
        enabled: true,
        port: 8080,
        secret: 'my-secret',
      },
    }));

    const loadConfig = await loadConfigFresh();
    const config = loadConfig();

    expect(config.notifications).toBeDefined();
    expect(config.notifications!.enabled).toBe(true);
    expect(config.notifications!.port).toBe(8080);
    expect(config.notifications!.secret).toBe('my-secret');
    expect(config.notifications!.github_events).toEqual(['push', 'pull_request', 'issues', 'workflow_run']);
    expect(config.notifications!.watched_branches).toEqual(['main', 'master', 'develop']);
    expect(config.notifications!.rate_limit.max_per_minute).toBe(30);
    expect(config.notifications!.rate_limit.cooldown_seconds).toBe(5);
  });

  it('should have undefined notifications when not configured', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: ['123'] },
      projects: { app: { path: '/tmp/app', adapter: 'claude' } },
    }));

    const loadConfig = await loadConfigFresh();
    const config = loadConfig();

    expect(config.notifications).toBeUndefined();
  });

  it('should convert allowed_users to strings', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: [12345, 67890] },
      projects: { app: { path: '/tmp/app', adapter: 'claude' } },
    }));

    const loadConfig = await loadConfigFresh();
    const config = loadConfig();

    expect(config.telegram.allowed_users).toEqual(['12345', '67890']);
  });

  it('should use default values when defaults not provided', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: ['123'] },
      projects: { app: { path: '/tmp/app', adapter: 'claude' } },
    }));

    const loadConfig = await loadConfigFresh();
    const config = loadConfig();

    expect(config.defaults.adapter).toBe('claude');
    expect(config.defaults.timeout).toBe(120);
    expect(config.defaults.max_message_length).toBe(4096);
    expect(config.defaults.session_ttl_hours).toBe(24);
    expect(config.defaults.command_timeout).toBe(60);
  });

  it('should exit if project path does not exist', async () => {
    // First call for config file check, second call for project path check
    mockedExistsSync.mockImplementation((path: unknown) => {
      const p = path as string;
      if (p.includes('devbridge.config.json')) return true;
      return false; // project path does not exist
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      telegram: { bot_token: 'test-token:ABC', allowed_users: ['123'] },
      projects: { app: { path: '/nonexistent/path', adapter: 'claude' } },
    }));

    const loadConfig = await loadConfigFresh();

    expect(() => loadConfig()).toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('path does not exist'));
  });
});
