import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAdapter } from '../../../src/adapters/claude.js';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/process.js', () => ({
  spawnCLI: vi.fn(),
}));

import { spawnCLI } from '../../../src/utils/process.js';

const mockedSpawnCLI = vi.mocked(spawnCLI);

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClaudeAdapter();
  });

  it('should have name "claude"', () => {
    expect(adapter.name).toBe('claude');
  });

  describe('isAvailable', () => {
    it('should return true when CLI is available', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '1.0.0',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
      expect(mockedSpawnCLI).toHaveBeenCalledWith('claude', ['--version'], expect.any(Object));
    });

    it('should return false when CLI is not available', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: 'not found',
        exitCode: 1,
        timedOut: false,
      });

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('chat', () => {
    it('should call spawnCLI with correct arguments', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: 'Hello from Claude',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', 'session-1', {
        cwd: '/tmp/project',
        timeout: 60,
        model: 'sonnet',
      });

      expect(result).toBe('Hello from Claude');
      expect(mockedSpawnCLI).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['-p', 'hello', '--session-id', 'session-1', '--model', 'sonnet']),
        expect.objectContaining({ cwd: '/tmp/project', timeout: 60 })
      );
    });

    it('should throw on timeout', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
        timedOut: true,
      });

      await expect(adapter.chat('hello', 'session-1', {
        cwd: '/tmp/project',
        timeout: 60,
      })).rejects.toThrow(/Timeout/);
    });

    it('should throw on non-zero exit code', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: 'Some error',
        exitCode: 1,
        timedOut: false,
      });

      await expect(adapter.chat('hello', 'session-1', {
        cwd: '/tmp/project',
      })).rejects.toThrow(/Erro ao processar/);
    });

    it('should throw corrupted session error when session error in stderr', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: 'Session not found or corrupted',
        exitCode: 1,
        timedOut: false,
      });

      await expect(adapter.chat('hello', 'session-1', {
        cwd: '/tmp/project',
      })).rejects.toThrow(/corrompida/);
    });

    it('should return "(resposta vazia)" when stdout is empty on success', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', 'session-1', {
        cwd: '/tmp/project',
      });

      expect(result).toBe('(resposta vazia)');
    });
  });

  describe('newSession', () => {
    it('should return a UUID session ID', () => {
      const sessionId = adapter.newSession('/tmp/project');
      expect(sessionId).toBe('mock-uuid-1234');
    });
  });

  describe('clearSession', () => {
    it('should not throw', () => {
      expect(() => adapter.clearSession('session-1')).not.toThrow();
    });
  });
});
