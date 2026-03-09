import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChatHandler } from '../../src/router.js';
import { StateManager } from '../../src/state.js';
import { AdapterRegistry } from '../../src/adapters/index.js';
import { createMockContext } from '../helpers/mock-telegram.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { createMockConfig } from '../helpers/test-utils.js';
import type { SessionManager } from '../../src/sessions/manager.js';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/utils/telegram.js', () => ({
  splitMessage: vi.fn((text: string) => [text]),
  sendWithMarkdown: vi.fn().mockResolvedValue(undefined),
  withTypingIndicator: vi.fn((_ctx: unknown, fn: () => Promise<unknown>) => fn()),
}));

describe('createChatHandler (router)', () => {
  let stateManager: StateManager;
  let registry: AdapterRegistry;
  let mockAdapter: ReturnType<typeof createMockAdapter>;
  let sessionManager: Partial<SessionManager>;
  const config = createMockConfig();

  beforeEach(() => {
    vi.clearAllMocks();

    stateManager = new StateManager();
    registry = new AdapterRegistry();
    mockAdapter = createMockAdapter('claude');
    registry.register(mockAdapter);

    sessionManager = {
      getOrCreate: vi.fn().mockReturnValue({
        id: 'session-1',
        cliSessionId: 'cli-session-1',
        projectName: 'test-project',
        messageCount: 0,
        lastMessageAt: new Date().toISOString(),
      }),
      update: vi.fn(),
      clearByProject: vi.fn(),
    };
  });

  it('should reply with no project active message if no project is set', async () => {
    const ctx = createMockContext({ chatId: 12345, text: 'hello' });
    const handler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhum projeto ativo'));
  });

  it('should reply with project not found if active project is not in config', async () => {
    const ctx = createMockContext({ chatId: 12345, text: 'hello' });
    stateManager.setActiveProject('12345', 'nonexistent-project');

    const handler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Projeto ativo nao encontrado'));
  });

  it('should dispatch message to adapter and send response', async () => {
    const ctx = createMockContext({ chatId: 12345, text: 'explain the code' });
    stateManager.setActiveProject('12345', 'test-project');
    mockAdapter.chat.mockResolvedValue('This code does X');

    const handler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    await handler(ctx as any);

    expect(mockAdapter.chat).toHaveBeenCalledWith(
      'explain the code',
      'cli-session-1',
      expect.objectContaining({
        cwd: '/tmp/test-project',
      })
    );
    expect(sessionManager.update).toHaveBeenCalled();
  });

  it('should not process message if text is empty', async () => {
    const ctx = createMockContext({ chatId: 12345 });
    (ctx as any).message = undefined;

    const handler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    await handler(ctx as any);

    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('should handle adapter errors and reply with error message', async () => {
    const ctx = createMockContext({ chatId: 12345, text: 'hello' });
    stateManager.setActiveProject('12345', 'test-project');
    mockAdapter.chat.mockRejectedValue(new Error('Adapter failed'));

    const handler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith('Adapter failed');
  });

  it('should clear session on corrupted session error', async () => {
    const ctx = createMockContext({ chatId: 12345, text: 'hello' });
    stateManager.setActiveProject('12345', 'test-project');
    mockAdapter.chat.mockRejectedValue(new Error('Sessao corrompida'));

    const handler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    await handler(ctx as any);

    expect(sessionManager.clearByProject).toHaveBeenCalledWith('test-project');
  });
});
