import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRunHandler } from '../../../src/commands/run.js';
import { StateManager } from '../../../src/state.js';
import { createMockContext } from '../../helpers/mock-telegram.js';
import { createMockConfig } from '../../helpers/test-utils.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/telegram.js', () => ({
  sendWithMarkdown: vi.fn().mockResolvedValue(undefined),
  withTypingIndicator: vi.fn((_ctx: unknown, fn: () => Promise<unknown>) => fn()),
}));

const mockResolve = vi.fn();
const mockGetAliases = vi.fn();
const mockExecute = vi.fn();

vi.mock('../../../src/security/sandbox.js', () => ({
  CommandSandbox: vi.fn().mockImplementation(() => ({
    resolve: mockResolve,
    getAvailableAliases: mockGetAliases,
    execute: mockExecute,
  })),
}));

describe('run command', () => {
  let stateManager: StateManager;
  const config = createMockConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
  });

  it('should show usage and available commands when no alias given', async () => {
    mockGetAliases.mockReturnValue(['test', 'lint']);

    const handler = createRunHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: '' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('test, lint'));
  });

  it('should show no commands message when no commands configured', async () => {
    mockGetAliases.mockReturnValue([]);

    const handler = createRunHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: '' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhum comando configurado'));
  });

  it('should reply with error for unknown command alias', async () => {
    mockResolve.mockReturnValue(null);
    mockGetAliases.mockReturnValue(['test', 'lint']);

    const handler = createRunHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: 'unknown' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao encontrado'));
  });

  it('should require an active project', async () => {
    mockResolve.mockReturnValue('yarn test');

    const handler = createRunHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: 'test' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhum projeto ativo'));
  });

  it('should execute command successfully', async () => {
    mockResolve.mockReturnValue('yarn test');
    mockExecute.mockResolvedValue({
      stdout: 'All tests passed',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      durationMs: 2500,
    });

    stateManager.setActiveProject('12345', 'test-project');

    const handler = createRunHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: 'test' });

    await handler(ctx as any);

    // Should send "Executando..." message first
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Executando'));
  });

  it('should handle timeout', async () => {
    mockResolve.mockReturnValue('yarn build');
    mockExecute.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 1,
      timedOut: true,
      durationMs: 60000,
    });

    stateManager.setActiveProject('12345', 'test-project');

    const handler = createRunHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345, match: 'build' });

    await handler(ctx as any);

    const { sendWithMarkdown } = await import('../../../src/utils/telegram.js');
    expect(sendWithMarkdown).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Timeout'));
  });
});
