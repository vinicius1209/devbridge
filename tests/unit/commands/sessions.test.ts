import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionsHandler, createSwitchHandler } from '../../../src/commands/sessions.js';
import { StateManager } from '../../../src/state.js';
import { createMockContext } from '../../helpers/mock-telegram.js';
import { createMockConfig, createMockSession } from '../../helpers/test-utils.js';
import type { SessionManager } from '../../../src/sessions/manager.js';

vi.mock('../../../src/utils/telegram.js', () => ({
  sendWithMarkdown: vi.fn().mockResolvedValue(undefined),
}));

import { sendWithMarkdown } from '../../../src/utils/telegram.js';
const mockedSendWithMarkdown = vi.mocked(sendWithMarkdown);

describe('sessions command', () => {
  let sessionManager: Partial<SessionManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionManager = {
      listActive: vi.fn(),
    };
  });

  it('should reply with no sessions message when none exist', async () => {
    (sessionManager.listActive as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const handler = createSessionsHandler(sessionManager as SessionManager);
    const ctx = createMockContext();

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhuma sessao ativa'));
  });

  it('should list all active sessions', async () => {
    const sessions = [
      createMockSession({ projectName: 'project-a', adapter: 'claude', messageCount: 5 }),
      createMockSession({ projectName: 'project-b', adapter: 'gemini', messageCount: 3 }),
    ];
    (sessionManager.listActive as ReturnType<typeof vi.fn>).mockReturnValue(sessions);

    const handler = createSessionsHandler(sessionManager as SessionManager);
    const ctx = createMockContext();

    await handler(ctx as any);

    expect(mockedSendWithMarkdown).toHaveBeenCalled();
    const sentText = mockedSendWithMarkdown.mock.calls[0][1];
    expect(sentText).toContain('project-a');
    expect(sentText).toContain('project-b');
    expect(sentText).toContain('5 msgs');
    expect(sentText).toContain('3 msgs');
  });
});

describe('switch command', () => {
  let stateManager: StateManager;
  const config = createMockConfig({
    projects: {
      'project-a': { path: '/tmp/a', adapter: 'claude' },
      'project-b': { path: '/tmp/b', adapter: 'gemini' },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
  });

  it('should show usage when no project name given', async () => {
    const handler = createSwitchHandler(config, stateManager);
    const ctx = createMockContext({ match: '' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Uso:'));
  });

  it('should switch to valid project', async () => {
    const handler = createSwitchHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: 'project-b' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Projeto ativo: project-b'));
    expect(stateManager.getActiveProject('12345')).toBe('project-b');
  });

  it('should reply with error for unknown project', async () => {
    const handler = createSwitchHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: 'nonexistent' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao encontrado'));
  });

  it('should switch by number', async () => {
    const handler = createSwitchHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: '2' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Projeto ativo: project-b'));
    expect(stateManager.getActiveProject('12345')).toBe('project-b');
  });

  it('should reject out-of-range number', async () => {
    const handler = createSwitchHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: '99' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao encontrado'));
  });
});
