import { spawn } from 'node:child_process';
import type { CommandResult } from '../types.js';
import { logger } from '../utils/logger.js';

export class CommandSandbox {
  private whitelist: Record<string, string>;

  constructor(commands: Record<string, string>) {
    this.whitelist = commands;
  }

  resolve(alias: string): string | null {
    return this.whitelist[alias] ?? null;
  }

  getAvailableAliases(): string[] {
    return Object.keys(this.whitelist);
  }

  async execute(alias: string, projectPath: string, timeout: number): Promise<CommandResult> {
    const command = this.resolve(alias);
    if (!command) {
      throw new Error(`Comando '${alias}' nao encontrado.`);
    }

    const startTime = Date.now();
    const parts = command.split(/\s+/);
    const bin = parts[0];
    const args = parts.slice(1);

    logger.info('Executing command', { alias, command, projectPath });

    return new Promise((resolve) => {
      const proc = spawn(bin, args, {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        // NEVER use shell: true to prevent injection
      });

      proc.stdin.end();

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 5000);
      }, timeout * 1000);

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 1,
          timedOut,
          durationMs: Date.now() - startTime,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          timedOut: false,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }
}
