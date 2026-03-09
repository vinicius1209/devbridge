import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/tmp/test-home'),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { loadSessions, saveSessions } from '../../../src/sessions/store.js';
import type { Session } from '../../../src/types.js';

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExistsSync = vi.mocked(existsSync);

describe('Session Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSessions', () => {
    it('should return empty map when file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      const sessions = loadSessions();
      expect(sessions.size).toBe(0);
    });

    it('should load sessions from JSON file', () => {
      mockedExistsSync.mockReturnValue(true);

      const sessionData: Session[] = [
        {
          id: 'session-1',
          projectName: 'project-a',
          projectPath: '/tmp/a',
          adapter: 'claude',
          cliSessionId: 'cli-1',
          messageCount: 5,
          createdAt: '2024-01-01T00:00:00Z',
          lastMessageAt: '2024-01-01T01:00:00Z',
        },
      ];

      mockedReadFileSync.mockReturnValue(JSON.stringify(sessionData));

      const sessions = loadSessions();
      expect(sessions.size).toBe(1);
      expect(sessions.get('session-1')?.projectName).toBe('project-a');
    });

    it('should handle corrupt JSON gracefully', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('not valid json{{{');

      const sessions = loadSessions();
      expect(sessions.size).toBe(0);
    });

    it('should handle non-array data gracefully', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(JSON.stringify({ not: 'an array' }));

      const sessions = loadSessions();
      expect(sessions.size).toBe(0);
    });
  });

  describe('saveSessions', () => {
    it('should write sessions as JSON array', () => {
      mockedExistsSync.mockReturnValue(true);

      const sessions = new Map<string, Session>();
      sessions.set('session-1', {
        id: 'session-1',
        projectName: 'project-a',
        projectPath: '/tmp/a',
        adapter: 'claude',
        cliSessionId: 'cli-1',
        messageCount: 5,
        createdAt: '2024-01-01T00:00:00Z',
        lastMessageAt: '2024-01-01T01:00:00Z',
      });

      saveSessions(sessions);

      expect(mockedWriteFileSync).toHaveBeenCalled();
      const written = JSON.parse(mockedWriteFileSync.mock.calls[0][1] as string);
      expect(written).toHaveLength(1);
      expect(written[0].id).toBe('session-1');
    });

    it('should create directory if it does not exist', () => {
      mockedExistsSync.mockReturnValue(false);

      const sessions = new Map<string, Session>();
      saveSessions(sessions);

      expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith(
        expect.stringContaining('.devbridge'),
        { recursive: true }
      );
    });

    it('should handle write errors gracefully', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedWriteFileSync.mockImplementation(() => { throw new Error('write error'); });

      const sessions = new Map<string, Session>();

      // Should not throw
      expect(() => saveSessions(sessions)).not.toThrow();
    });
  });
});
