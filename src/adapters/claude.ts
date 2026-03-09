import { v4 as uuidv4 } from 'uuid';
import type { CLIAdapter, ChatOptions } from './base.js';
import { spawnCLI } from '../utils/process.js';
import { logger } from '../utils/logger.js';

// Track which sessions have already been started (have at least 1 message)
const activeSessions = new Set<string>();

export class ClaudeAdapter implements CLIAdapter {
  name = 'claude';

  async isAvailable(): Promise<boolean> {
    const result = await spawnCLI('claude', ['--version'], {
      cwd: process.cwd(),
      timeout: 10,
    });
    return result.exitCode === 0;
  }

  async chat(message: string, sessionId: string, options: ChatOptions): Promise<string> {
    const args = [
      '-p', message,
      '--session-id', sessionId,
      '--output-format', 'text',
      '--allowedTools', 'Read,Glob,Grep',
    ];

    // Resume existing session
    if (activeSessions.has(sessionId)) {
      args.push('--resume');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    const timeout = options.timeout ?? 120;

    logger.debug('Claude CLI call', { sessionId, resume: activeSessions.has(sessionId) });

    const result = await spawnCLI('claude', args, {
      cwd: this.projectPath || process.cwd(),
      timeout,
    });

    if (result.timedOut) {
      throw new Error(`Timeout — Claude demorou mais de ${timeout}s. Tente novamente ou /clear para nova sessao.`);
    }

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Claude CLI error', { exitCode: result.exitCode, stderr: result.stderr });

      // If session is corrupted, clear it and try again
      if (errorMsg.includes('session') || errorMsg.includes('Session')) {
        activeSessions.delete(sessionId);
        throw new Error('Sessao corrompida. Use /clear para iniciar nova conversa.');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    // Mark session as active after first successful message
    activeSessions.add(sessionId);

    return result.stdout || '(resposta vazia)';
  }

  private projectPath: string | null = null;

  newSession(projectPath: string): string {
    this.projectPath = projectPath;
    const sessionId = uuidv4();
    logger.info('New Claude session', { sessionId, projectPath });
    return sessionId;
  }

  clearSession(sessionId: string): void {
    activeSessions.delete(sessionId);
    logger.info('Session cleared', { sessionId });
  }
}
