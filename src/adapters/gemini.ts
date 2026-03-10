import type { CLIAdapter, ChatOptions, ChatResult } from '../types.js';
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

  async chat(message: string, sessionId: string | null, options: ChatOptions & { cwd: string }): Promise<ChatResult> {
    const args = [
      '-p', message,
    ];

    if (sessionId) {
      args.push('--resume', 'latest');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    const timeout = options.timeout ?? 120;

    logger.debug('Gemini CLI call', { sessionId, resume: !!sessionId });

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

      if (errorMsg.includes('session') || errorMsg.includes('Session') || errorMsg.includes('resume')) {
        throw new Error('SESSION_EXPIRED');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    return {
      text: result.stdout || '(resposta vazia)',
      sessionId: `gemini:${options.cwd}`,
    };
  }
}
