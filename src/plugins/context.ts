import type { Context } from 'grammy';
import type { ProjectConfig, CommandResult } from '../types.js';
import type { CommandContext } from './types.js';
import { splitMessage, sendWithMarkdown, withTypingIndicator } from '../utils/telegram.js';
import { spawn } from 'node:child_process';

export function createCommandContext(
  ctx: Context,
  args: string[],
  rawArgs: string,
  project: ProjectConfig & { name: string },
  chatId: string
): CommandContext {
  return {
    args,
    rawArgs,
    project,
    chatId,
    async reply(text: string) {
      const chunks = splitMessage(text);
      for (const chunk of chunks) {
        await sendWithMarkdown(ctx, chunk);
      }
    },
    async withTyping<T>(fn: () => Promise<T>): Promise<T> {
      return withTypingIndicator(ctx, fn);
    },
    async exec(command: string, execArgs: string[] = []): Promise<CommandResult> {
      const startTime = Date.now();
      return new Promise((resolve) => {
        const proc = spawn(command, execArgs, {
          cwd: project.path,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        proc.stdin.end();

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

        proc.on('close', (code) => {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code ?? 1,
            timedOut: false,
            durationMs: Date.now() - startTime,
          });
        });

        proc.on('error', (err) => {
          resolve({
            stdout: '',
            stderr: err.message,
            exitCode: 1,
            timedOut: false,
            durationMs: Date.now() - startTime,
          });
        });
      });
    },
  };
}
