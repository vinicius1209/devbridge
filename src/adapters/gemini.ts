import type { CLIAdapter, ChatOptions, ChatResult, StreamChatOptions } from '../types.js';
import { spawnCLI, spawnCLIStreaming } from '../utils/process.js';
import { logger } from '../utils/logger.js';

const DEFAULT_ALLOWED_TOOLS = 'ReadFileTool,GlobTool,GrepTool';

export class GeminiAdapter implements CLIAdapter {
  name = 'gemini';

  async isAvailable(): Promise<boolean> {
    const result = await spawnCLI('gemini', ['--version'], {
      cwd: process.cwd(),
      timeout: 10,
    });
    return result.exitCode === 0;
  }

  private buildBaseArgs(
    message: string,
    options: ChatOptions,
    sessionId: string | null,
  ): string[] {
    const args = ['-p', message];

    const tools = options.allowedTools ?? DEFAULT_ALLOWED_TOOLS;
    args.push('--allowed-tools', tools);

    if (options.skipPermissions) {
      args.push('--yolo');
    }

    if (sessionId) {
      args.push('--resume', 'latest');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    return args;
  }

  async chat(
    message: string,
    sessionId: string | null,
    options: ChatOptions & { cwd: string },
  ): Promise<ChatResult> {
    const args = this.buildBaseArgs(message, options, sessionId);
    const timeout = options.timeout ?? 120;

    logger.debug('Gemini CLI call', { sessionId, resume: !!sessionId });

    const result = await spawnCLI('gemini', args, {
      cwd: options.cwd,
      timeout,
    });

    if (result.timedOut) {
      throw new Error(
        `Timeout — Gemini demorou mais de ${timeout}s. Tente novamente ou /clear para nova sessao.`,
      );
    }

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Gemini CLI error', { exitCode: result.exitCode, stderr: result.stderr });

      if (
        errorMsg.includes('session') ||
        errorMsg.includes('Session') ||
        errorMsg.includes('resume')
      ) {
        throw new Error('SESSION_EXPIRED');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    return {
      text: result.stdout || '(resposta vazia)',
      sessionId: `gemini:${options.cwd}`,
    };
  }

  async chatStream(
    message: string,
    sessionId: string | null,
    options: StreamChatOptions & { cwd: string },
  ): Promise<ChatResult> {
    const args = this.buildBaseArgs(message, options, sessionId);
    const timeout = options.timeout ?? 600;

    logger.debug('Gemini CLI streaming call', { sessionId, resume: !!sessionId });

    let fullText = '';

    const result = await spawnCLIStreaming('gemini', args, {
      cwd: options.cwd,
      timeout,
      inactivityTimeout: options.inactivityTimeout,
      minChunkSize: options.minChunkSize,
      onChunk: async (chunk: string) => {
        if (chunk.length > fullText.length) {
          const newText = chunk;
          const delta = newText.slice(fullText.length);
          fullText = newText;
          await options.onChunk(delta);
        }
      },
    });

    if (result.timedOut) {
      const inactivity = options.inactivityTimeout ?? 300;
      throw new Error(
        `Timeout — Gemini ficou inativo por ${inactivity}s (sem produzir output). Pode ter travado. Tente novamente ou /clear para nova sessao.`,
      );
    }

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Gemini CLI streaming error', {
        exitCode: result.exitCode,
        stderr: result.stderr,
      });

      if (
        errorMsg.includes('session') ||
        errorMsg.includes('Session') ||
        errorMsg.includes('resume')
      ) {
        throw new Error('SESSION_EXPIRED');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    return {
      text: fullText || result.stdout || '(resposta vazia)',
      sessionId: `gemini:${options.cwd}`,
    };
  }
}
