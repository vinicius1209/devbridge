import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitMessage, sendWithMarkdown } from '../../../src/utils/telegram.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('splitMessage', () => {
  it('should return single chunk for short messages', () => {
    const result = splitMessage('Hello world');
    expect(result).toEqual(['Hello world']);
  });

  it('should return single chunk for messages at max length', () => {
    const msg = 'a'.repeat(4096);
    const result = splitMessage(msg);
    expect(result).toEqual([msg]);
  });

  it('should split long messages', () => {
    const msg = 'a'.repeat(5000);
    const result = splitMessage(msg, 4096);
    expect(result.length).toBeGreaterThan(1);
    expect(result.join('').length).toBe(5000);
  });

  it('should respect custom max length', () => {
    const msg = 'a'.repeat(100);
    const result = splitMessage(msg, 50);
    expect(result.length).toBe(2);
    expect(result[0].length).toBe(50);
    expect(result[1].length).toBe(50);
  });

  it('should try to split at newlines', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join('\n');
    const result = splitMessage(lines, 200);

    // Each chunk should end at a newline boundary (or be the last chunk)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].endsWith('\n')).toBe(true);
    }
  });

  it('should try to split at code block boundaries', () => {
    const text = 'Introduction\n```\ncode block 1\n```\nMore text\n```\ncode block 2\n```\nEnd';
    const result = splitMessage(text, 40);

    expect(result.length).toBeGreaterThan(1);
    // All chunks joined should equal original
    expect(result.join('')).toBe(text);
  });

  it('should handle empty string', () => {
    const result = splitMessage('');
    expect(result).toEqual(['']);
  });
});

describe('sendWithMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send with Markdown parse mode', async () => {
    const ctx = {
      reply: vi.fn().mockResolvedValue(undefined),
    };

    await sendWithMarkdown(ctx as any, 'Hello *world*');

    expect(ctx.reply).toHaveBeenCalledWith('Hello *world*', { parse_mode: 'Markdown' });
  });

  it('should fallback to plain text on Markdown error', async () => {
    const ctx = {
      reply: vi.fn()
        .mockRejectedValueOnce(new Error('Markdown parse error'))
        .mockResolvedValueOnce(undefined),
    };

    await sendWithMarkdown(ctx as any, 'Hello');

    expect(ctx.reply).toHaveBeenCalledTimes(2);
    // Second call should be without parse_mode
    expect(ctx.reply).toHaveBeenLastCalledWith('Hello');
  });

  it('should handle double failure gracefully', async () => {
    const ctx = {
      reply: vi.fn()
        .mockRejectedValueOnce(new Error('Markdown error'))
        .mockRejectedValueOnce(new Error('Plain text error')),
    };

    // Should not throw
    await expect(sendWithMarkdown(ctx as any, 'Hello')).resolves.toBeUndefined();
  });
});
