import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager } from '../../src/state.js';
import { AdapterRegistry } from '../../src/adapters/index.js';
import { createChatHandler } from '../../src/router.js';
import { createSwitchHandler } from '../../src/commands/sessions.js';
import { createMockContext } from '../helpers/mock-telegram.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import type { SessionManager } from '../../src/sessions/manager.js';
import type { DevBridgeConfig } from '../../src/types.js';

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

import '../../src/utils/telegram.js';

describe('E2E: Project Switch Flow', () => {
  let stateManager: StateManager;
  let registry: AdapterRegistry;
  let claudeAdapter: ReturnType<typeof createMockAdapter>;
  let geminiAdapter: ReturnType<typeof createMockAdapter>;
  let sessionManager: Partial<SessionManager>;

  const config: DevBridgeConfig = {
    telegram: {
      bot_token: 'test-token:ABC',
      allowed_users: ['12345'],
    },
    projects: {
      'frontend': {
        path: '/tmp/frontend',
        adapter: 'claude',
        model: 'sonnet',
        description: 'React frontend',
      },
      'backend': {
        path: '/tmp/backend',
        adapter: 'gemini',
        description: 'Node.js backend',
      },
    },
    commands: {},
    defaults: {
      adapter: 'claude',
      timeout: 120,
      max_message_length: 4096,
      session_ttl_hours: 24,
      command_timeout: 60,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    stateManager = new StateManager();
    registry = new AdapterRegistry();

    claudeAdapter = createMockAdapter('claude');
    geminiAdapter = createMockAdapter('gemini');
    registry.register(claudeAdapter);
    registry.register(geminiAdapter);

    let sessionCounter = 0;
    const sessions = new Map<string, any>();

    sessionManager = {
      getOrCreate: vi.fn().mockImplementation((projectName: string, projectPath: string, adapter: string) => {
        const existing = [...sessions.values()].find(s => s.projectName === projectName);
        if (existing) return existing;

        sessionCounter++;
        const session = {
          id: `session-${sessionCounter}`,
          projectName,
          projectPath,
          adapter,
          cliSessionId: `cli-session-${sessionCounter}`,
          messageCount: 0,
          createdAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString(),
        };
        sessions.set(session.id, session);
        return session;
      }),
      update: vi.fn(),
      clearByProject: vi.fn(),
    };
  });

  it('should switch project and use correct adapter', async () => {
    const chatHandler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    // Chat with frontend project (claude adapter)
    stateManager.setActiveProject('12345', 'frontend');
    claudeAdapter.chat.mockResolvedValue('Frontend response');

    const ctx1 = createMockContext({ chatId: 12345, text: 'analyze components' });
    await chatHandler(ctx1 as any);

    expect(claudeAdapter.chat).toHaveBeenCalledTimes(1);
    expect(geminiAdapter.chat).not.toHaveBeenCalled();

    // Switch to backend project
    const switchHandler = createSwitchHandler(config, stateManager);
    const switchCtx = createMockContext({ chatId: 12345, match: 'backend' });
    await switchHandler(switchCtx as any);

    expect(stateManager.getActiveProject('12345')).toBe('backend');

    // Chat with backend project (gemini adapter)
    geminiAdapter.chat.mockResolvedValue('Backend response');

    const ctx2 = createMockContext({ chatId: 12345, text: 'show API routes' });
    await chatHandler(ctx2 as any);

    expect(geminiAdapter.chat).toHaveBeenCalledTimes(1);
    expect(geminiAdapter.chat).toHaveBeenCalledWith(
      'show API routes',
      expect.any(String),
      expect.objectContaining({ cwd: '/tmp/backend' })
    );
  });

  it('should maintain separate sessions per project', async () => {
    const chatHandler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    // Chat with frontend
    stateManager.setActiveProject('12345', 'frontend');
    claudeAdapter.chat.mockResolvedValue('Frontend answer');

    await chatHandler(createMockContext({ chatId: 12345, text: 'msg1' }) as any);

    // Switch to backend
    stateManager.setActiveProject('12345', 'backend');
    geminiAdapter.chat.mockResolvedValue('Backend answer');

    await chatHandler(createMockContext({ chatId: 12345, text: 'msg2' }) as any);

    // Switch back to frontend
    stateManager.setActiveProject('12345', 'frontend');
    claudeAdapter.chat.mockResolvedValue('Frontend answer 2');

    await chatHandler(createMockContext({ chatId: 12345, text: 'msg3' }) as any);

    // getOrCreate should have been called 3 times, but frontend session should be reused
    expect(sessionManager.getOrCreate).toHaveBeenCalledTimes(3);

    // Verify the cwd is correct for each call
    expect(claudeAdapter.chat).toHaveBeenCalledTimes(2);
    expect(claudeAdapter.chat.mock.calls[0][2].cwd).toBe('/tmp/frontend');
    expect(claudeAdapter.chat.mock.calls[1][2].cwd).toBe('/tmp/frontend');

    expect(geminiAdapter.chat).toHaveBeenCalledTimes(1);
    expect(geminiAdapter.chat.mock.calls[0][2].cwd).toBe('/tmp/backend');
  });

  it('should show error when switching to nonexistent project', async () => {
    const switchHandler = createSwitchHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: 'nonexistent' });

    await switchHandler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao encontrado'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('1. frontend'));
  });
});
