import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../../src/sessions/manager.js';

let uuidCounter = 0;

vi.mock('uuid', () => ({
  v4: vi.fn(() => `uuid-${++uuidCounter}`),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/sessions/store.js', () => ({
  loadSessions: vi.fn(() => new Map()),
  saveSessions: vi.fn(),
}));

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    manager = new SessionManager();
  });

  describe('getOrCreate', () => {
    it('should create a new session with null cliSessionId', () => {
      const session = manager.getOrCreate('my-project', '/tmp/project', 'claude');

      expect(session).toBeDefined();
      expect(session.projectName).toBe('my-project');
      expect(session.projectPath).toBe('/tmp/project');
      expect(session.adapter).toBe('claude');
      expect(session.cliSessionId).toBeNull();
      expect(session.messageCount).toBe(0);
    });

    it('should return existing session for the same project', () => {
      const session1 = manager.getOrCreate('my-project', '/tmp/project', 'claude');
      const session2 = manager.getOrCreate('my-project', '/tmp/project', 'claude');

      expect(session1.id).toBe(session2.id);
    });

    it('should create separate sessions for different projects', () => {
      const session1 = manager.getOrCreate('project-a', '/tmp/a', 'claude');
      const session2 = manager.getOrCreate('project-b', '/tmp/b', 'claude');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('update', () => {
    it('should update session fields', () => {
      const session = manager.getOrCreate('my-project', '/tmp/project', 'claude');

      manager.update(session.id, { messageCount: 10, cliSessionId: 'real-cli-id' });

      const updated = manager.getByProject('my-project');
      expect(updated?.messageCount).toBe(10);
      expect(updated?.cliSessionId).toBe('real-cli-id');
    });

    it('should do nothing for non-existent session', () => {
      expect(() => manager.update('nonexistent', { messageCount: 5 })).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove session', () => {
      const session = manager.getOrCreate('my-project', '/tmp/project', 'claude');

      manager.clear(session.id);

      expect(manager.getByProject('my-project')).toBeNull();
    });

    it('should do nothing for non-existent session', () => {
      expect(() => manager.clear('nonexistent')).not.toThrow();
    });
  });

  describe('clearByProject', () => {
    it('should clear session by project name', () => {
      manager.getOrCreate('my-project', '/tmp/project', 'claude');

      manager.clearByProject('my-project');

      expect(manager.getByProject('my-project')).toBeNull();
    });

    it('should do nothing if project has no session', () => {
      expect(() => manager.clearByProject('nonexistent')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove expired sessions', () => {
      const session = manager.getOrCreate('my-project', '/tmp/project', 'claude');

      const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      manager.update(session.id, { lastMessageAt: longAgo });

      manager.cleanup(24);

      expect(manager.getByProject('my-project')).toBeNull();
    });

    it('should keep non-expired sessions', () => {
      manager.getOrCreate('my-project', '/tmp/project', 'claude');

      manager.cleanup(24);

      expect(manager.getByProject('my-project')).not.toBeNull();
    });
  });

  describe('listActive', () => {
    it('should return all sessions sorted by last message date (newest first)', () => {
      const s1 = manager.getOrCreate('project-a', '/tmp/a', 'claude');
      manager.getOrCreate('project-b', '/tmp/b', 'claude');

      const oldDate = new Date(Date.now() - 60000).toISOString();
      manager.update(s1.id, { lastMessageAt: oldDate });

      const active = manager.listActive();
      expect(active).toHaveLength(2);
      expect(active[0].projectName).toBe('project-b');
      expect(active[1].projectName).toBe('project-a');
    });

    it('should return empty array when no sessions', () => {
      expect(manager.listActive()).toHaveLength(0);
    });
  });

  describe('getActive', () => {
    it('should return the most recently used session', () => {
      const s1 = manager.getOrCreate('project-a', '/tmp/a', 'claude');
      manager.getOrCreate('project-b', '/tmp/b', 'claude');

      const oldDate = new Date(Date.now() - 60000).toISOString();
      manager.update(s1.id, { lastMessageAt: oldDate });

      const active = manager.getActive();
      expect(active?.projectName).toBe('project-b');
    });

    it('should return null when no sessions', () => {
      expect(manager.getActive()).toBeNull();
    });
  });

  describe('getByProject', () => {
    it('should return session for given project', () => {
      manager.getOrCreate('my-project', '/tmp/project', 'claude');

      const session = manager.getByProject('my-project');
      expect(session).not.toBeNull();
      expect(session?.projectName).toBe('my-project');
    });

    it('should return null for nonexistent project', () => {
      expect(manager.getByProject('nonexistent')).toBeNull();
    });
  });
});
