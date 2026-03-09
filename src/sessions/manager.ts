import type { Session } from '../types.js';
import { getAdapter } from '../adapters/index.js';
import { loadSessions, saveSessions } from './store.js';
import { logger } from '../utils/logger.js';

export class SessionManager {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = loadSessions();
    logger.info(`Loaded ${this.sessions.size} session(s) from disk`);
  }

  getOrCreate(projectName: string, projectPath: string, adapterName: string): Session {
    // Look for existing session for this project
    for (const session of this.sessions.values()) {
      if (session.projectName === projectName) {
        return session;
      }
    }

    // Create new session
    const adapter = getAdapter(adapterName);
    const cliSessionId = adapter.newSession(projectPath);

    const session: Session = {
      id: cliSessionId,
      projectName,
      projectPath,
      adapter: adapterName as 'claude',
      cliSessionId,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    this.save();

    logger.info('Created new session', { sessionId: session.id, project: projectName });
    return session;
  }

  update(sessionId: string, updates: Partial<Session>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    Object.assign(session, updates);
    this.save();
  }

  clear(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const adapter = getAdapter(session.adapter);
      adapter.clearSession(session.cliSessionId);
      this.sessions.delete(sessionId);
      this.save();
      logger.info('Session cleared', { sessionId, project: session.projectName });
    }
  }

  clearByProject(projectName: string): void {
    for (const [id, session] of this.sessions) {
      if (session.projectName === projectName) {
        this.clear(id);
        return;
      }
    }
  }

  cleanup(ttlHours: number): void {
    const now = Date.now();
    const ttlMs = ttlHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      const lastMessage = new Date(session.lastMessageAt).getTime();
      if (now - lastMessage > ttlMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.save();
      logger.info(`Cleaned up ${cleaned} expired session(s)`);
    }
  }

  getActive(): Session | null {
    // Return the most recently used session
    let latest: Session | null = null;
    for (const session of this.sessions.values()) {
      if (!latest || session.lastMessageAt > latest.lastMessageAt) {
        latest = session;
      }
    }
    return latest;
  }

  getByProject(projectName: string): Session | null {
    for (const session of this.sessions.values()) {
      if (session.projectName === projectName) {
        return session;
      }
    }
    return null;
  }

  private save(): void {
    saveSessions(this.sessions);
  }
}
