import { v4 as uuidv4 } from 'uuid';
import type { CLIAdapter, ChatOptions } from '../types.js';
import { spawnCLI } from '../utils/process.js';
import { logger } from '../utils/logger.js';

export class GeminiAdapter implements CLIAdapter {
  name = 'gemini';

  async isAvailable(): Promise<boolean> {
    const result = await spawnCLI('gemini', ['--version'], {
      cwd: process.cwd(),
      timeout: 10,
    });
    return result.exitCode === 0;
  }

  async chat(message: string, sessionId: string, options: ChatOptions & { cwd: string }): Promise<string> {
    // Gemini CLI flags - adapt based on actual CLI availability
    const args = [
      '-p', message,
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

    const timeout = options.timeout ?? 120;

    logger.debug('Gemini CLI call', { sessionId });

    const result = await spawnCLI('gemini', args, {
      cwd: options.cwd,
      timeout,
    });

    if (result.timedOut) {
      throw new Error(`Timeout — Gemini demorou mais de ${timeout}s. Tente novamente ou /clear para nova sessao.`);
    }

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Gemini CLI error', { exitCode: result.exitCode, stderr: result.stderr });
      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    return result.stdout || '(resposta vazia)';
  }

  newSession(_projectPath: string): string {
    const sessionId = uuidv4();
    logger.info('New Gemini session', { sessionId });
    return sessionId;
  }

  clearSession(sessionId: string): void {
    logger.info('Gemini session cleared', { sessionId });
  }
}
