import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Session } from '../../src/types.js';

// We use a real temp directory to test actual file I/O
// but mock the homedir to use it
const testDir = join(tmpdir(), `devbridge-test-${Date.now()}`);
const storeDir = join(testDir, '.devbridge');
const storeFile = join(storeDir, 'sessions.json');

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: vi.fn(() => testDir),
  };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Session Persistence Integration', () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('should save and load sessions from disk', async () => {
    // Import fresh to pick up mocked homedir
    const { saveSessions, loadSessions } = await import('../../src/sessions/store.js');

    const sessions = new Map<string, Session>();
    sessions.set('session-1', {
      id: 'session-1',
      projectName: 'test-project',
      projectPath: '/tmp/test',
      adapter: 'claude',
      cliSessionId: 'cli-1',
      messageCount: 10,
      createdAt: '2024-01-01T00:00:00Z',
      lastMessageAt: '2024-01-01T12:00:00Z',
    });

    saveSessions(sessions);

    // Verify file was created
    expect(existsSync(storeFile)).toBe(true);

    // Load sessions back
    const loaded = loadSessions();
    expect(loaded.size).toBe(1);

    const session = loaded.get('session-1');
    expect(session).toBeDefined();
    expect(session!.projectName).toBe('test-project');
    expect(session!.messageCount).toBe(10);
    expect(session!.adapter).toBe('claude');
  });

  it('should handle saving multiple sessions', async () => {
    const { saveSessions, loadSessions } = await import('../../src/sessions/store.js');

    const sessions = new Map<string, Session>();
    sessions.set('s1', {
      id: 's1',
      projectName: 'project-a',
      projectPath: '/tmp/a',
      adapter: 'claude',
      cliSessionId: 'cli-a',
      messageCount: 5,
      createdAt: '2024-01-01T00:00:00Z',
      lastMessageAt: '2024-01-01T06:00:00Z',
    });
    sessions.set('s2', {
      id: 's2',
      projectName: 'project-b',
      projectPath: '/tmp/b',
      adapter: 'gemini',
      cliSessionId: 'cli-b',
      messageCount: 3,
      createdAt: '2024-01-01T00:00:00Z',
      lastMessageAt: '2024-01-01T08:00:00Z',
    });

    saveSessions(sessions);

    const loaded = loadSessions();
    expect(loaded.size).toBe(2);
    expect(loaded.get('s1')?.projectName).toBe('project-a');
    expect(loaded.get('s2')?.projectName).toBe('project-b');
  });

  it('should handle corrupt file gracefully', async () => {
    const { loadSessions } = await import('../../src/sessions/store.js');

    mkdirSync(storeDir, { recursive: true });
    writeFileSync(storeFile, 'THIS IS NOT VALID JSON!!!');

    const loaded = loadSessions();
    expect(loaded.size).toBe(0);
  });

  it('should handle empty directory', async () => {
    const { loadSessions } = await import('../../src/sessions/store.js');

    // No file exists yet
    const loaded = loadSessions();
    expect(loaded.size).toBe(0);
  });
});
