import { describe, it, expect, vi } from 'vitest';
import { createNotificationsHandler } from '../../../src/commands/notifications.js';
import { createMockContext } from '../../helpers/mock-telegram.js';

function createMockFilter() {
  return {
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: vi.fn().mockReturnValue(false),
    shouldNotify: vi.fn().mockReturnValue(true),
  };
}

describe('notifications command', () => {
  it('disables notifications with "off"', async () => {
    const filter = createMockFilter();
    const handler = createNotificationsHandler(filter as any);
    const ctx = createMockContext({ match: 'off' });
    await handler(ctx as any);
    expect(filter.mute).toHaveBeenCalledWith(999999);
    expect(ctx.reply).toHaveBeenCalledWith('Notificacoes desativadas.');
  });

  it('enables notifications with "on"', async () => {
    const filter = createMockFilter();
    const handler = createNotificationsHandler(filter as any);
    const ctx = createMockContext({ match: 'on' });
    await handler(ctx as any);
    expect(filter.unmute).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Notificacoes ativadas.');
  });

  it('shows status when no argument (active)', async () => {
    const filter = createMockFilter();
    filter.isMuted.mockReturnValue(false);
    const handler = createNotificationsHandler(filter as any);
    const ctx = createMockContext({ match: '' });
    await handler(ctx as any);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ativas'));
  });

  it('shows status when no argument (muted)', async () => {
    const filter = createMockFilter();
    filter.isMuted.mockReturnValue(true);
    const handler = createNotificationsHandler(filter as any);
    const ctx = createMockContext({ match: '' });
    await handler(ctx as any);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('desativadas'));
  });
});
