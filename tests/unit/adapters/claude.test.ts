import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAdapter } from '../../../src/adapters/claude.js';

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
  spawnCLIStreaming: vi.fn(),
}));

import { spawnCLI, spawnCLIStreaming } from '../../../src/utils/process.js';

const mockedSpawnCLI = vi.mocked(spawnCLI);
const mockedSpawnCLIStreaming = vi.mocked(spawnCLIStreaming);

function mockJsonResponse(result: string, sessionId: string) {
  return JSON.stringify({ result, session_id: sessionId, is_error: false });
}

function mockStreamJsonLines(lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n');
}

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
    it('should use --output-format json and parse response', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: mockJsonResponse('Hello from Claude', 'cli-uuid-123'),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', null, {
        cwd: '/tmp/project',
        timeout: 60,
        model: 'sonnet',
      });

      expect(result).toEqual({ text: 'Hello from Claude', sessionId: 'cli-uuid-123' });
      expect(mockedSpawnCLI).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['-p', 'hello', '--output-format', 'json', '--model', 'sonnet']),
        expect.objectContaining({ cwd: '/tmp/project', timeout: 60 }),
      );
    });

    it('should not include --session-id in args', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: mockJsonResponse('response', 'uuid-1'),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await adapter.chat('hello', null, { cwd: '/tmp/project' });

      const args = mockedSpawnCLI.mock.calls[0][1];
      expect(args).not.toContain('--session-id');
    });

    it('should add --resume when sessionId is provided', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: mockJsonResponse('Resumed', 'existing-uuid'),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', 'existing-uuid', {
        cwd: '/tmp/project',
        timeout: 60,
      });

      expect(result).toEqual({ text: 'Resumed', sessionId: 'existing-uuid' });
      const args = mockedSpawnCLI.mock.calls[0][1];
      expect(args).toContain('--resume');
      expect(args).toContain('existing-uuid');
    });

    it('should not add --resume when sessionId is null', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: mockJsonResponse('New session', 'new-uuid'),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await adapter.chat('hello', null, { cwd: '/tmp/project' });

      const args = mockedSpawnCLI.mock.calls[0][1];
      expect(args).not.toContain('--resume');
    });

    it('should throw on timeout', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
        timedOut: true,
      });

      await expect(
        adapter.chat('hello', null, {
          cwd: '/tmp/project',
          timeout: 60,
        }),
      ).rejects.toThrow(/Timeout/);
    });

    it('should throw SESSION_EXPIRED on session errors', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: 'Session not found or corrupted',
        exitCode: 1,
        timedOut: false,
      });

      await expect(
        adapter.chat('hello', 'old-session', {
          cwd: '/tmp/project',
        }),
      ).rejects.toThrow('SESSION_EXPIRED');
    });

    it('should throw on non-zero exit code', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: 'Some error',
        exitCode: 1,
        timedOut: false,
      });

      await expect(
        adapter.chat('hello', null, {
          cwd: '/tmp/project',
        }),
      ).rejects.toThrow(/Erro ao processar/);
    });

    it('should fallback to raw stdout when JSON parse fails', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: 'Plain text response',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', 'session-1', {
        cwd: '/tmp/project',
      });

      expect(result).toEqual({ text: 'Plain text response', sessionId: 'session-1' });
    });

    it('should return "(resposta vazia)" when result is empty', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: JSON.stringify({ result: '', session_id: 'uuid-1', is_error: false }),
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', null, {
        cwd: '/tmp/project',
      });

      expect(result.text).toBe('(resposta vazia)');
    });
  });

  describe('chatStream', () => {
    it('should exist as a method', () => {
      expect(adapter.chatStream).toBeDefined();
    });

    it('should use stream-json output format', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await adapter.chatStream!('hello', null, {
        cwd: '/tmp/project',
        onChunk: () => {},
      });

      const args = mockedSpawnCLIStreaming.mock.calls[0][1];
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
    });

    it('should call onChunk with text deltas', async () => {
      const streamOutput = mockStreamJsonLines([
        { type: 'assistant', message: 'Hello' },
        { type: 'assistant', message: 'Hello World' },
        { type: 'result', session_id: 'session-123', result: 'Hello World' },
      ]);

      mockedSpawnCLIStreaming.mockImplementation(async (_cmd, _args, options) => {
        if (options.onChunk) {
          await options.onChunk(streamOutput);
        }
        return {
          stdout: streamOutput,
          stderr: '',
          exitCode: 0,
          timedOut: false,
        };
      });

      const result = await adapter.chatStream!('test', null, {
        cwd: '/tmp/project',
        onChunk: () => {},
      });

      expect(result.sessionId).toBe('session-123');
    });

    it('should use default stream timeout of 600s', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await adapter.chatStream!('hello', null, {
        cwd: '/tmp/project',
        onChunk: () => {},
      });

      const options = mockedSpawnCLIStreaming.mock.calls[0][2];
      expect(options.timeout).toBe(600);
    });

    it('should throw on stream timeout', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
        timedOut: true,
      });

      await expect(
        adapter.chatStream!('hello', null, {
          cwd: '/tmp/project',
          onChunk: () => {},
          timeout: 300,
        }),
      ).rejects.toThrow(/Timeout/);
    });

    it('should throw SESSION_EXPIRED on session errors', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: '',
        stderr: 'Session not found',
        exitCode: 1,
        timedOut: false,
      });

      await expect(
        adapter.chatStream!('hello', 'old-session', {
          cwd: '/tmp/project',
          onChunk: () => {},
        }),
      ).rejects.toThrow('SESSION_EXPIRED');
    });

    it('should add --resume when sessionId is provided', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await adapter.chatStream!('hello', 'session-456', {
        cwd: '/tmp/project',
        onChunk: () => {},
      });

      const args = mockedSpawnCLIStreaming.mock.calls[0][1];
      expect(args).toContain('--resume');
      expect(args).toContain('session-456');
    });

    it('should pass minChunkSize option', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await adapter.chatStream!('hello', null, {
        cwd: '/tmp/project',
        onChunk: () => {},
        minChunkSize: 200,
      });

      const options = mockedSpawnCLIStreaming.mock.calls[0][2];
      expect(options.minChunkSize).toBe(200);
    });
  });
});
