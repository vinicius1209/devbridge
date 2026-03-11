import {
  appendFileSync,
  mkdirSync,
  existsSync,
  statSync,
  renameSync,
  unlinkSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_DIR = join(homedir(), '.devbridge', 'logs');
const LOG_FILE = join(LOG_DIR, 'devbridge.log');
const MAX_LOG_SIZE_MB = 10;
const MAX_LOG_FILES = 5;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = 'info';

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function rotateLogsIfNeeded() {
  try {
    const stats = statSync(LOG_FILE);
    const sizeMB = stats.size / (1024 * 1024);

    if (sizeMB >= MAX_LOG_SIZE_MB) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = join(LOG_DIR, `devbridge-${timestamp}.log`);

      renameSync(LOG_FILE, rotatedFile);

      const files = readdirSync(LOG_DIR)
        .filter((f) => f.startsWith('devbridge-') && f.endsWith('.log'))
        .sort()
        .reverse();

      files.slice(MAX_LOG_FILES).forEach((f) => {
        try {
          unlinkSync(join(LOG_DIR, f));
        } catch {}
      });
    }
  } catch {
    // File doesn't exist yet
  }
}

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

function log(level: LogLevel, message: string, meta?: unknown) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const formatted = formatMessage(level, message, meta);

  // Console output
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }

  // File output
  try {
    ensureLogDir();
    rotateLogsIfNeeded();
    appendFileSync(LOG_FILE, formatted + '\n');
  } catch {
    // Silently fail file logging
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
  setLevel: (level: LogLevel) => {
    minLevel = level;
  },
};
