import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAdapter } from '../../../src/adapters/gemini.js';

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

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GeminiAdapter();
  });

  it('should have name "gemini"', () => {
    expect(adapter.name).toBe('gemini');
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
      expect(mockedSpawnCLI).toHaveBeenCalledWith('gemini', ['--version'], expect.any(Object));
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
        stdout: 'Hello from Gemini',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', null, {
        cwd: '/tmp/project',
        timeout: 60,
        model: 'gemini-pro',
      });

      expect(result).toEqual({ text: 'Hello from Gemini', sessionId: 'gemini:/tmp/project' });
      expect(mockedSpawnCLI).toHaveBeenCalledWith(
        'gemini',
        expect.arrayContaining(['-p', 'hello', '--model', 'gemini-pro']),
        expect.objectContaining({ cwd: '/tmp/project', timeout: 60 }),
      );
    });

    it('should add --resume latest when sessionId is provided', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: 'Resumed response',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', 'gemini:/tmp/project', {
        cwd: '/tmp/project',
        timeout: 60,
      });

      expect(result.text).toBe('Resumed response');
      const args = mockedSpawnCLI.mock.calls[0][1];
      expect(args).toContain('--resume');
      expect(args).toContain('latest');
    });

    it('should not add --resume when sessionId is null', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: 'New response',
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
          timeout: 30,
        }),
      ).rejects.toThrow(/Timeout/);
    });

    it('should throw SESSION_EXPIRED on session errors', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: 'Error: could not resume session',
        exitCode: 1,
        timedOut: false,
      });

      await expect(
        adapter.chat('hello', 'gemini:/tmp/project', {
          cwd: '/tmp/project',
        }),
      ).rejects.toThrow('SESSION_EXPIRED');
    });

    it('should throw on non-zero exit code', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: 'Error occurred',
        exitCode: 1,
        timedOut: false,
      });

      await expect(
        adapter.chat('hello', null, {
          cwd: '/tmp/project',
        }),
      ).rejects.toThrow(/Erro ao processar/);
    });

    it('should return "(resposta vazia)" on empty success', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', null, {
        cwd: '/tmp/project',
      });

      expect(result.text).toBe('(resposta vazia)');
    });

    it('should work without model option', async () => {
      mockedSpawnCLI.mockResolvedValue({
        stdout: 'response',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chat('hello', null, {
        cwd: '/tmp/project',
      });

      expect(result.text).toBe('response');
      const callArgs = mockedSpawnCLI.mock.calls[0][1];
      expect(callArgs).not.toContain('--model');
    });
  });

  describe('chatStream', () => {
    it('should exist as a method', () => {
      expect(adapter.chatStream).toBeDefined();
    });

    it('should call spawnCLIStreaming with correct arguments', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: 'Streamed response',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      const result = await adapter.chatStream!('hello', null, {
        cwd: '/tmp/project',
        onChunk: () => {},
      });

      expect(result.sessionId).toBe('gemini:/tmp/project');
      expect(mockedSpawnCLIStreaming).toHaveBeenCalledWith(
        'gemini',
        expect.arrayContaining(['-p', 'hello']),
        expect.objectContaining({ cwd: '/tmp/project' }),
      );
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

    it('should call onChunk with text deltas', async () => {
      const chunks: string[] = [];

      mockedSpawnCLIStreaming.mockImplementation(async (_cmd, _args, options) => {
        if (options.onChunk) {
          await options.onChunk('Full response text');
        }
        return {
          stdout: 'Full response text',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        };
      });

      await adapter.chatStream!('test', null, {
        cwd: '/tmp/project',
        onChunk: (chunk) => {
          chunks.push(chunk);
        },
      });

      expect(chunks.length).toBeGreaterThan(0);
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
        stderr: 'could not resume session',
        exitCode: 1,
        timedOut: false,
      });

      await expect(
        adapter.chatStream!('hello', 'gemini:/tmp/project', {
          cwd: '/tmp/project',
          onChunk: () => {},
        }),
      ).rejects.toThrow('SESSION_EXPIRED');
    });

    it('should add --resume latest when sessionId is provided', async () => {
      mockedSpawnCLIStreaming.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });

      await adapter.chatStream!('hello', 'gemini:/tmp/project', {
        cwd: '/tmp/project',
        onChunk: () => {},
      });

      const args = mockedSpawnCLIStreaming.mock.calls[0][1];
      expect(args).toContain('--resume');
      expect(args).toContain('latest');
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
