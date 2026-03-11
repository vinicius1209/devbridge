import type { CLIAdapter, ChatOptions, ChatResult, StreamChatOptions } from '../types.js';
import { spawnCLI, spawnCLIStreaming } from '../utils/process.js';
import { logger } from '../utils/logger.js';

interface ClaudeJsonResponse {
  result: string;
  session_id: string;
  is_error: boolean;
}

interface ClaudeStreamMessage {
  type: string;
  message?: string;
  session_id?: string;
  result?: string;
}

const DEFAULT_ALLOWED_TOOLS = 'Read,Glob,Grep';

export class ClaudeAdapter implements CLIAdapter {
  name = 'claude';

  async isAvailable(): Promise<boolean> {
    const result = await spawnCLI('claude', ['--version'], {
      cwd: process.cwd(),
      timeout: 10,
    });
    return result.exitCode === 0;
  }

  private buildBaseArgs(
    message: string,
    outputFormat: string,
    options: ChatOptions,
    sessionId: string | null,
  ): string[] {
    const tools = options.allowedTools ?? DEFAULT_ALLOWED_TOOLS;
    const args = ['-p', message, '--output-format', outputFormat, '--allowedTools', tools];

    if (options.skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    if (sessionId) {
      args.push('--resume', sessionId);
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
    const args = this.buildBaseArgs(message, 'json', options, sessionId);
    const timeout = options.timeout ?? 120;

    logger.debug('Claude CLI call', { sessionId, resume: !!sessionId });

    const result = await spawnCLI('claude', args, {
      cwd: options.cwd,
      timeout,
    });

    if (result.timedOut) {
      throw new Error(
        `Timeout — Claude demorou mais de ${timeout}s. Tente novamente ou /clear para nova sessao.`,
      );
    }

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Claude CLI error', { exitCode: result.exitCode, stderr: result.stderr });

      if (
        errorMsg.includes('session') ||
        errorMsg.includes('Session') ||
        errorMsg.includes('No matching')
      ) {
        throw new Error('SESSION_EXPIRED');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    try {
      const json: ClaudeJsonResponse = JSON.parse(result.stdout);
      return {
        text: json.result || '(resposta vazia)',
        sessionId: json.session_id || null,
      };
    } catch {
      logger.warn('Failed to parse Claude JSON response, using raw output');
      return {
        text: result.stdout || '(resposta vazia)',
        sessionId,
      };
    }
  }

  async chatStream(
    message: string,
    sessionId: string | null,
    options: StreamChatOptions & { cwd: string },
  ): Promise<ChatResult> {
    const args = this.buildBaseArgs(message, 'stream-json', options, sessionId);
    args.push('--verbose');
    const timeout = options.timeout ?? 600;

    logger.debug('Claude CLI streaming call', { sessionId, resume: !!sessionId, args });

    let fullText = '';
    let lastSessionId: string | null = sessionId;
    let pendingLine = '';

    const result = await spawnCLIStreaming('claude', args, {
      cwd: options.cwd,
      timeout,
      inactivityTimeout: options.inactivityTimeout,
      minChunkSize: options.minChunkSize,
      onChunk: async (rawChunk: string) => {
        const lines = (pendingLine + rawChunk).split('\n');
        pendingLine = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const obj: ClaudeStreamMessage = JSON.parse(line);

            if (obj.type === 'assistant' && obj.message) {
              const newText = obj.message;
              if (newText.length > fullText.length) {
                const chunk = newText.slice(fullText.length);
                fullText = newText;
                await options.onChunk(chunk);
              }
            } else if (obj.type === 'result' && obj.result) {
              if (obj.result.length > fullText.length) {
                const chunk = obj.result.slice(fullText.length);
                fullText = obj.result;
                await options.onChunk(chunk);
              }
            }

            if (obj.session_id) {
              lastSessionId = obj.session_id;
            }
          } catch {
            // Non-JSON line, might be partial or error output
            logger.debug('Non-JSON line in stream', { line: line.slice(0, 100) });
          }
        }
      },
    });

    if (pendingLine.trim()) {
      try {
        const obj: ClaudeStreamMessage = JSON.parse(pendingLine);
        if (obj.session_id) {
          lastSessionId = obj.session_id;
        }
        if (obj.result && obj.result.length > fullText.length) {
          const chunk = obj.result.slice(fullText.length);
          fullText = obj.result;
          await options.onChunk(chunk);
        }
      } catch {
        // Ignore parse errors on final pending line
      }
    }

    if (result.timedOut) {
      const inactivity = options.inactivityTimeout ?? 300;
      throw new Error(
        `Timeout — Claude ficou inativo por ${inactivity}s (sem produzir output). Pode ter travado. Tente novamente ou /clear para nova sessao.`,
      );
    }

    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Claude CLI streaming error', {
        exitCode: result.exitCode,
        stderr: result.stderr,
      });

      if (
        errorMsg.includes('session') ||
        errorMsg.includes('Session') ||
        errorMsg.includes('No matching')
      ) {
        throw new Error('SESSION_EXPIRED');
      }

      throw new Error(`Erro ao processar: ${errorMsg.slice(0, 200)}`);
    }

    return {
      text: fullText || '(resposta vazia)',
      sessionId: lastSessionId,
    };
  }
}
