import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Session } from '../types.js';
import { logger } from '../utils/logger.js';

const STORE_DIR = join(homedir(), '.devbridge');
const STORE_FILE = join(STORE_DIR, 'sessions.json');

export function loadSessions(): Map<string, Session> {
  const sessions = new Map<string, Session>();

  if (!existsSync(STORE_FILE)) return sessions;

  try {
    const data = JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
    if (Array.isArray(data)) {
      for (const session of data) {
        sessions.set(session.id, session);
      }
    }
  } catch (err) {
    logger.warn('Failed to load sessions from disk, starting fresh', {
      error: (err as Error).message,
    });
  }

  return sessions;
}

export function saveSessions(sessions: Map<string, Session>): void {
  try {
    if (!existsSync(STORE_DIR)) {
      mkdirSync(STORE_DIR, { recursive: true });
    }
    const data = Array.from(sessions.values());
    writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('Failed to save sessions to disk', {
      error: (err as Error).message,
    });
  }
}
