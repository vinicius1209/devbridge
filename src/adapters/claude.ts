import type { CLIAdapter, ChatOptions, ChatResult } from '../types.js';
import { spawnCLI } from '../utils/process.js';
import { logger } from '../utils/logger.js';

interface ClaudeJsonResponse {
  result: string;
  session_id: string;
  is_error: boolean;
}

export class ClaudeAdapter implements CLIAdapter {
  name = 'claude';

  async isAvailable(): Promise<boolean> {
    const result = await spawnCLI('claude', ['--version'], {
      cwd: process.cwd(),
      timeout: 10,
    });
    return result.exitCode === 0;
  }

  async chat(message: string, sessionId: string | null, options: ChatOptions & { cwd: string }): Promise<ChatResult> {
    const args = [
      '-p', message,
      '--output-format', 'json',
      '--allowedTools', 'Read,Glob,Grep',
    ];

    if (sessionId) {
      args.push('--resume', sessionId);
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    const timeout = options.timeout ?? 120;

    logger.debug('Claude CLI call', { sessionId, resume: !!sessionId });

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

      if (errorMsg.includes('session') || errorMsg.includes('Session') || errorMsg.includes('No matching')) {
        throw new Error('SESSION_EXPIRED');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    // Parse JSON response from Claude CLI
    try {
      const json: ClaudeJsonResponse = JSON.parse(result.stdout);
      return {
        text: json.result || '(resposta vazia)',
        sessionId: json.session_id || null,
      };
    } catch {
      // Fallback: if JSON parsing fails, return raw stdout
      logger.warn('Failed to parse Claude JSON response, using raw output');
      return {
        text: result.stdout || '(resposta vazia)',
        sessionId,
      };
    }
  }
}
