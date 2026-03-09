import { describe, it, expect, vi } from 'vitest';
import { createMuteHandler } from '../../../src/commands/mute.js';
import { createMockContext } from '../../helpers/mock-telegram.js';

function createMockFilter() {
  return {
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: vi.fn().mockReturnValue(false),
    shouldNotify: vi.fn().mockReturnValue(true),
  };
}

describe('mute command', () => {
  it('shows usage when no argument provided', async () => {
    const filter = createMockFilter();
    const handler = createMuteHandler(filter as any);
    const ctx = createMockContext({ match: '' });
    await handler(ctx as any);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/mute'));
  });

  it('rejects invalid number', async () => {
    const filter = createMockFilter();
    const handler = createMuteHandler(filter as any);
    const ctx = createMockContext({ match: 'abc' });
    await handler(ctx as any);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('numero positivo'));
  });

  it('rejects negative number', async () => {
    const filter = createMockFilter();
    const handler = createMuteHandler(filter as any);
    const ctx = createMockContext({ match: '-5' });
    await handler(ctx as any);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('numero positivo'));
  });

  it('mutes for specified minutes', async () => {
    const filter = createMockFilter();
    const handler = createMuteHandler(filter as any);
    const ctx = createMockContext({ match: '60' });
    await handler(ctx as any);
    expect(filter.mute).toHaveBeenCalledWith(60);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('60 minutos'));
  });
});
