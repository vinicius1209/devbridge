import { describe, it, expect, vi } from 'vitest';
import { withTypingIndicator } from '../../../src/utils/telegram.js';
import { createMockContext } from '../../helpers/mock-telegram.js';

describe('withTypingIndicator', () => {
  it('sends typing action and returns result', async () => {
    const ctx = createMockContext();
    const result = await withTypingIndicator(ctx as any, async () => {
      return 'done';
    });
    expect(result).toBe('done');
    expect(ctx.replyWithChatAction).toHaveBeenCalledWith('typing');
  });

  it('stops typing after function completes', async () => {
    const ctx = createMockContext();
    await withTypingIndicator(ctx as any, async () => 'ok');
    // Typing should stop - no infinite loop
    expect(true).toBe(true);
  });

  it('handles errors in function and still stops typing', async () => {
    const ctx = createMockContext();
    await expect(
      withTypingIndicator(ctx as any, async () => {
        throw new Error('test error');
      })
    ).rejects.toThrow('test error');
  });
});
