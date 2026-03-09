import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandSandbox } from '../../../src/security/sandbox.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock child_process spawn
vi.mock('node:child_process', () => {
  const mockOn = vi.fn();
  const mockStdout = { on: vi.fn() };
  const mockStderr = { on: vi.fn() };
  const mockStdin = { end: vi.fn() };
  const mockProc = {
    stdout: mockStdout,
    stderr: mockStderr,
    stdin: mockStdin,
    on: mockOn,
    kill: vi.fn(),
    killed: false,
  };

  return {
    spawn: vi.fn(() => mockProc),
    __mockProc: mockProc,
    __mockOn: mockOn,
    __mockStdout: mockStdout,
    __mockStderr: mockStderr,
  };
});

describe('CommandSandbox', () => {
  const commands = {
    test: 'yarn test',
    lint: 'yarn lint',
    build: 'yarn build',
    status: 'git status --short',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolve', () => {
    it('should resolve known command aliases', () => {
      const sandbox = new CommandSandbox(commands);

      expect(sandbox.resolve('test')).toBe('yarn test');
      expect(sandbox.resolve('lint')).toBe('yarn lint');
      expect(sandbox.resolve('build')).toBe('yarn build');
    });

    it('should return null for unknown aliases', () => {
      const sandbox = new CommandSandbox(commands);

      expect(sandbox.resolve('unknown')).toBeNull();
      expect(sandbox.resolve('deploy')).toBeNull();
    });
  });

  describe('getAvailableAliases', () => {
    it('should return all command aliases', () => {
      const sandbox = new CommandSandbox(commands);

      const aliases = sandbox.getAvailableAliases();
      expect(aliases).toEqual(['test', 'lint', 'build', 'status']);
    });

    it('should return empty array when no commands configured', () => {
      const sandbox = new CommandSandbox({});
      expect(sandbox.getAvailableAliases()).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should throw for unknown command', async () => {
      const sandbox = new CommandSandbox(commands);

      await expect(sandbox.execute('unknown', '/tmp', 60)).rejects.toThrow(
        /Comando 'unknown' nao encontrado/
      );
    });

    it('should spawn process with correct arguments', async () => {
      const { spawn, __mockProc, __mockStdout, __mockStderr } = await import('node:child_process') as any;

      // Setup the mock to simulate process completion
      __mockProc.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'close') {
          // Simulate immediate close with exit code 0
          setTimeout(() => cb(0), 0);
        }
      });

      __mockStdout.on.mockImplementation((event: string, cb: Function) => {
        if (event === 'data') {
          cb(Buffer.from('test output'));
        }
      });

      __mockStderr.on.mockImplementation((_event: string, _cb: Function) => {});

      const sandbox = new CommandSandbox(commands);
      const result = await sandbox.execute('test', '/tmp/project', 60);

      expect(spawn).toHaveBeenCalledWith('yarn', ['test'], expect.objectContaining({
        cwd: '/tmp/project',
      }));
      expect(result.stdout).toBe('test output');
      expect(result.exitCode).toBe(0);
    });
  });
});
