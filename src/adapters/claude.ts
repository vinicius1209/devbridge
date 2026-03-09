import { v4 as uuidv4 } from 'uuid';
import type { CLIAdapter, ChatOptions } from '../types.js';
import { spawnCLI } from '../utils/process.js';
import { logger } from '../utils/logger.js';

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

  async chat(message: string, sessionId: string, options: ChatOptions & { cwd: string }): Promise<string> {
    const args = [
      '-p', message,
      '--session-id', sessionId,
      '--output-format', 'text',
      '--allowedTools', 'Read,Glob,Grep',
    ];

    if (activeSessions.has(sessionId)) {
      args.push('--resume');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    const timeout = options.timeout ?? 120;

    logger.debug('Claude CLI call', { sessionId, resume: activeSessions.has(sessionId) });

    const result = await spawnCLI('claude', args, {
      cwd: options.cwd,
      timeout,
    });

    if (result.timedOut) {
      throw new Error(`Timeout — Claude demorou mais de ${timeout}s. Tente novamente ou /clear para nova sessao.`);
    }

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Claude CLI error', { exitCode: result.exitCode, stderr: result.stderr });

      if (errorMsg.includes('session') || errorMsg.includes('Session')) {
        activeSessions.delete(sessionId);
        throw new Error('Sessao corrompida. Use /clear para iniciar nova conversa.');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    activeSessions.add(sessionId);
    return result.stdout || '(resposta vazia)';
  }

  newSession(_projectPath: string): string {
    const sessionId = uuidv4();
    logger.info('New Claude session', { sessionId });
    return sessionId;
  }

  clearSession(sessionId: string): void {
    activeSessions.delete(sessionId);
    logger.info('Session cleared', { sessionId });
  }
}
