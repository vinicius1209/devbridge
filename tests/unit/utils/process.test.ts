import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// We need to mock child_process.spawn for these tests
const mockStdin = { end: vi.fn() };
const mockStdout = { on: vi.fn() };
const mockStderr = { on: vi.fn() };
const mockOn = vi.fn();
const mockKill = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdin: mockStdin,
    stdout: mockStdout,
    stderr: mockStderr,
    on: mockOn,
    kill: mockKill,
    killed: false,
  })),
}));

import { spawnCLI } from '../../../src/utils/process.js';
import { spawn } from 'node:child_process';

describe('spawnCLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: simulate immediate successful close
    mockOn.mockImplementation((event: string, cb: Function) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 0);
      }
    });
    mockStdout.on.mockImplementation((_event: string, _cb: Function) => {});
    mockStderr.on.mockImplementation((_event: string, _cb: Function) => {});
  });

  it('should spawn process with correct arguments', async () => {
    const result = await spawnCLI('claude', ['--version'], {
      cwd: '/tmp',
      timeout: 10,
    });

    expect(spawn).toHaveBeenCalledWith('claude', ['--version'], expect.objectContaining({
      cwd: '/tmp',
    }));
    expect(result.exitCode).toBe(0);
  });

  it('should capture stdout', async () => {
    mockStdout.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        cb(Buffer.from('version 1.0.0'));
      }
    });

    const result = await spawnCLI('claude', ['--version'], {
      cwd: '/tmp',
      timeout: 10,
    });

    expect(result.stdout).toBe('version 1.0.0');
  });

  it('should capture stderr', async () => {
    mockStderr.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        cb(Buffer.from('error output'));
      }
    });

    const result = await spawnCLI('claude', ['--version'], {
      cwd: '/tmp',
      timeout: 10,
    });

    expect(result.stderr).toBe('error output');
  });

  it('should handle process errors', async () => {
    mockOn.mockImplementation((event: string, cb: Function) => {
      if (event === 'error') {
        setTimeout(() => cb(new Error('spawn ENOENT')), 0);
      }
    });

    const result = await spawnCLI('nonexistent', [], {
      cwd: '/tmp',
      timeout: 10,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('spawn ENOENT');
  });

  it('should close stdin immediately', async () => {
    await spawnCLI('test', [], { cwd: '/tmp', timeout: 10 });

    expect(mockStdin.end).toHaveBeenCalled();
  });
});
