import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClearHandler } from '../../../src/commands/clear.js';
import { StateManager } from '../../../src/state.js';
import { createMockContext } from '../../helpers/mock-telegram.js';
import { createMockConfig } from '../../helpers/test-utils.js';
import type { SessionManager } from '../../../src/sessions/manager.js';

describe('clear command', () => {
  let stateManager: StateManager;
  let sessionManager: Partial<SessionManager>;
  const config = createMockConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
    sessionManager = {
      clearByProject: vi.fn(),
    };
  });

  it('should reply with no project active message when no project is set', async () => {
    const handler = createClearHandler(sessionManager as SessionManager, stateManager, config);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhum projeto ativo'));
    expect(sessionManager.clearByProject).not.toHaveBeenCalled();
  });

  it('should clear session for active project', async () => {
    stateManager.setActiveProject('12345', 'test-project');

    const handler = createClearHandler(sessionManager as SessionManager, stateManager, config);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    expect(sessionManager.clearByProject).toHaveBeenCalledWith('test-project');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Sessao limpa'));
  });
});
