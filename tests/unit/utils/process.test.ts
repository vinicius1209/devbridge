import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

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

import { spawnCLI, spawnCLIStreaming } from '../../../src/utils/process.js';
import { spawn } from 'node:child_process';

describe('spawnCLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['--version'],
      expect.objectContaining({
        cwd: '/tmp',
      }),
    );
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

describe('spawnCLIStreaming', () => {
  let chunksReceived: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    chunksReceived = [];

    mockOn.mockImplementation((event: string, cb: Function) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 0);
      }
    });
    mockStdout.on.mockImplementation((_event: string, _cb: Function) => {});
    mockStderr.on.mockImplementation((_event: string, _cb: Function) => {});
  });

  it('should call onChunk with data chunks', async () => {
    const testData = 'Hello World';
    mockStdout.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        cb(Buffer.from(testData));
      }
    });

    const result = await spawnCLIStreaming('claude', ['-p', 'test'], {
      cwd: '/tmp',
      timeout: 10,
      onChunk: (chunk) => {
        chunksReceived.push(chunk);
      },
    });

    expect(result.stdout).toBe(testData);
    expect(chunksReceived.length).toBeGreaterThan(0);
  });

  it('should respect minChunkSize', async () => {
    mockStdout.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        cb(Buffer.from('short'));
      }
    });

    await spawnCLIStreaming('claude', [], {
      cwd: '/tmp',
      timeout: 10,
      minChunkSize: 100,
      onChunk: (chunk) => {
        chunksReceived.push(chunk);
      },
    });

    expect(chunksReceived.length).toBe(1);
    expect(chunksReceived[0]).toBe('short');
  });

  it('should flush buffer on close even if below minChunkSize', async () => {
    mockStdout.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        cb(Buffer.from('tiny'));
      }
    });

    await spawnCLIStreaming('claude', [], {
      cwd: '/tmp',
      timeout: 10,
      minChunkSize: 1000,
      onChunk: (chunk) => {
        chunksReceived.push(chunk);
      },
    });

    expect(chunksReceived).toEqual(['tiny']);
  });

  it('should handle async onChunk callbacks', async () => {
    const asyncChunks: string[] = [];
    mockStdout.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        cb(Buffer.from('async test'));
      }
    });

    await spawnCLIStreaming('claude', [], {
      cwd: '/tmp',
      timeout: 10,
      onChunk: async (chunk) => {
        await new Promise((r) => setTimeout(r, 10));
        asyncChunks.push(chunk);
      },
    });

    expect(asyncChunks.length).toBeGreaterThan(0);
  });

  it('should handle process errors gracefully', async () => {
    mockOn.mockImplementation((event: string, cb: Function) => {
      if (event === 'error') {
        setTimeout(() => cb(new Error('spawn failed')), 0);
      }
    });

    const result = await spawnCLIStreaming('nonexistent', [], {
      cwd: '/tmp',
      timeout: 10,
      onChunk: () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('spawn failed');
  });

  it('should capture stderr', async () => {
    mockStderr.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        cb(Buffer.from('warning message'));
      }
    });

    const result = await spawnCLIStreaming('claude', [], {
      cwd: '/tmp',
      timeout: 10,
      onChunk: () => {},
    });

    expect(result.stderr).toBe('warning message');
  });
});
