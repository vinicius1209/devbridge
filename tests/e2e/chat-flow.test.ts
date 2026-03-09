import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager } from '../../src/state.js';
import { AdapterRegistry } from '../../src/adapters/index.js';
import { createChatHandler } from '../../src/router.js';
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

import { sendWithMarkdown } from '../../src/utils/telegram.js';
const mockedSendWithMarkdown = vi.mocked(sendWithMarkdown);

describe('E2E: Full Chat Flow', () => {
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
      update: vi.fn().mockImplementation((sessionId: string, updates: any) => {
        const session = sessions.get(sessionId);
        if (session) Object.assign(session, updates);
      }),
      clearByProject: vi.fn().mockImplementation((projectName: string) => {
        for (const [id, s] of sessions) {
          if (s.projectName === projectName) {
            sessions.delete(id);
            break;
          }
        }
      }),
    };
  });

  it('should handle full conversation flow: no project -> select project -> chat', async () => {
    const chatHandler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    // Step 1: Message with no project selected
    const ctx1 = createMockContext({ chatId: 12345, text: 'hello' });
    await chatHandler(ctx1 as any);

    expect(ctx1.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhum projeto ativo'));

    // Step 2: Set active project
    stateManager.setActiveProject('12345', 'test-project');

    // Step 3: Now chat should work
    mockAdapter.chat.mockResolvedValue('The code does X, Y, Z.');

    const ctx2 = createMockContext({ chatId: 12345, text: 'explain the main function' });
    await chatHandler(ctx2 as any);

    expect(mockAdapter.chat).toHaveBeenCalledWith(
      'explain the main function',
      expect.any(String),
      expect.objectContaining({ cwd: '/tmp/test-project' })
    );
    expect(mockedSendWithMarkdown).toHaveBeenCalledWith(expect.anything(), 'The code does X, Y, Z.');
  });

  it('should handle multi-turn conversation', async () => {
    stateManager.setActiveProject('12345', 'test-project');

    const chatHandler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    // Turn 1
    mockAdapter.chat.mockResolvedValue('Response to turn 1');
    const ctx1 = createMockContext({ chatId: 12345, text: 'What is this project?' });
    await chatHandler(ctx1 as any);

    // Turn 2
    mockAdapter.chat.mockResolvedValue('Response to turn 2');
    const ctx2 = createMockContext({ chatId: 12345, text: 'Show me the tests' });
    await chatHandler(ctx2 as any);

    // Turn 3
    mockAdapter.chat.mockResolvedValue('Response to turn 3');
    const ctx3 = createMockContext({ chatId: 12345, text: 'How can I improve coverage?' });
    await chatHandler(ctx3 as any);

    expect(mockAdapter.chat).toHaveBeenCalledTimes(3);

    // All calls should use the same CLI session ID
    const sessionIds = mockAdapter.chat.mock.calls.map(call => call[1]);
    expect(new Set(sessionIds).size).toBe(1);

    // Session update should have been called for each message
    expect(sessionManager.update).toHaveBeenCalledTimes(3);
  });

  it('should handle adapter error and recover', async () => {
    stateManager.setActiveProject('12345', 'test-project');

    const chatHandler = createChatHandler(
      sessionManager as SessionManager,
      stateManager,
      registry,
      config
    );

    // First message: adapter fails
    mockAdapter.chat.mockRejectedValue(new Error('Temporary failure'));
    const ctx1 = createMockContext({ chatId: 12345, text: 'hello' });
    await chatHandler(ctx1 as any);

    expect(ctx1.reply).toHaveBeenCalledWith('Temporary failure');

    // Second message: adapter works again
    mockAdapter.chat.mockResolvedValue('Back online');
    const ctx2 = createMockContext({ chatId: 12345, text: 'hello again' });
    await chatHandler(ctx2 as any);

    expect(mockedSendWithMarkdown).toHaveBeenCalledWith(expect.anything(), 'Back online');
  });
});
