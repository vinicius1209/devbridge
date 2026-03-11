import { spawn } from 'node:child_process';
import { logger } from './logger.js';

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface StreamSpawnOptions {
  cwd: string;
  timeout: number;
  inactivityTimeout?: number;
  onChunk: (chunk: string) => void | Promise<void>;
  minChunkSize?: number;
}

export interface StreamSpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export function spawnCLI(
  command: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 5000);
    }, options.timeout * 1000);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
        timedOut,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      logger.error('Process spawn error', { command, error: err.message });
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        timedOut: false,
      });
    });
  });
}

export function spawnCLIStreaming(
  command: string,
  args: string[],
  options: StreamSpawnOptions,
): Promise<StreamSpawnResult> {
  return new Promise((resolve) => {
    logger.debug('Spawning streaming process', {
      command,
      args,
      cwd: options.cwd,
      timeout: options.timeout,
    });

    const proc = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let buffer = '';
    const minChunkSize = options.minChunkSize ?? 50;
    const inactivityTimeout = options.inactivityTimeout ?? 300;

    const killProcess = (reason: string) => {
      timedOut = true;
      logger.warn(`Killing streaming process: ${reason}`, {
        command,
        stdoutLength: stdout.length,
      });
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 5000);
    };

    // Hard max timeout as safety net
    const maxTimer = setTimeout(() => {
      killProcess(`max timeout ${options.timeout}s exceeded`);
    }, options.timeout * 1000);

    // Inactivity timeout: resets on every output
    let inactivityTimer = setTimeout(() => {
      killProcess(`no output for ${inactivityTimeout}s`);
    }, inactivityTimeout * 1000);

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        killProcess(`no output for ${inactivityTimeout}s`);
      }, inactivityTimeout * 1000);
    };

    const flushBuffer = async () => {
      if (buffer.length >= minChunkSize) {
        try {
          await options.onChunk(buffer);
        } catch (err) {
          logger.warn('Error in onChunk callback', { error: (err as Error).message });
        }
        buffer = '';
      }
    };

    proc.stdout.on('data', async (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      buffer += chunk;
      resetInactivityTimer();
      await flushBuffer();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      resetInactivityTimer();
    });

    proc.on('close', async (code) => {
      clearTimeout(maxTimer);
      clearTimeout(inactivityTimer);
      logger.debug('Streaming process closed', {
        code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        timedOut,
      });

      if (buffer.length > 0) {
        try {
          await options.onChunk(buffer);
        } catch (err) {
          logger.warn('Error in onChunk callback (final)', { error: (err as Error).message });
        }
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
        timedOut,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(maxTimer);
      clearTimeout(inactivityTimer);
      logger.error('Process spawn error (streaming)', { command, error: err.message });
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
        timedOut: false,
      });
    });
  });
}
