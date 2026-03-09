import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatusHandler } from '../../../src/commands/status.js';
import { StateManager } from '../../../src/state.js';
import { createMockContext } from '../../helpers/mock-telegram.js';
import { createMockConfig, createMockSession } from '../../helpers/test-utils.js';
import type { SessionManager } from '../../../src/sessions/manager.js';

vi.mock('../../../src/utils/telegram.js', () => ({
  sendWithMarkdown: vi.fn().mockResolvedValue(undefined),
}));

import { sendWithMarkdown } from '../../../src/utils/telegram.js';
const mockedSendWithMarkdown = vi.mocked(sendWithMarkdown);

describe('status command', () => {
  let stateManager: StateManager;
  let sessionManager: Partial<SessionManager>;
  const config = createMockConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
    sessionManager = {
      getByProject: vi.fn(),
    };
  });

  it('should reply with no project active message when no project is set', async () => {
    const handler = createStatusHandler(sessionManager as SessionManager, stateManager, config);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhum projeto ativo'));
  });

  it('should reply with no session message when project has no session', async () => {
    stateManager.setActiveProject('12345', 'test-project');
    (sessionManager.getByProject as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const handler = createStatusHandler(sessionManager as SessionManager, stateManager, config);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhuma sessao'));
  });

  it('should show session status when session exists', async () => {
    stateManager.setActiveProject('12345', 'test-project');
    const session = createMockSession({ messageCount: 10 });
    (sessionManager.getByProject as ReturnType<typeof vi.fn>).mockReturnValue(session);

    const handler = createStatusHandler(sessionManager as SessionManager, stateManager, config);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    expect(mockedSendWithMarkdown).toHaveBeenCalled();
    const sentText = mockedSendWithMarkdown.mock.calls[0][1];
    expect(sentText).toContain('test-project');
    expect(sentText).toContain('10 mensagens');
    expect(sentText).toContain('claude');
  });
});
