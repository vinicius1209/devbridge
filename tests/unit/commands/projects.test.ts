import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProjectsHandler, createProjectHandler } from '../../../src/commands/projects.js';
import { StateManager } from '../../../src/state.js';
import { AdapterRegistry } from '../../../src/adapters/index.js';
import { createMockContext } from '../../helpers/mock-telegram.js';
import { createMockConfig } from '../../helpers/test-utils.js';
import { createMockAdapter } from '../../helpers/mock-adapter.js';

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
}));

import { sendWithMarkdown } from '../../../src/utils/telegram.js';
const mockedSendWithMarkdown = vi.mocked(sendWithMarkdown);

describe('projects command', () => {
  let stateManager: StateManager;
  const config = createMockConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
  });

  it('should list all projects', async () => {
    const handler = createProjectsHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    expect(mockedSendWithMarkdown).toHaveBeenCalled();
    const sentText = mockedSendWithMarkdown.mock.calls[0][1];
    expect(sentText).toContain('test-project');
    expect(sentText).toContain('claude');
  });

  it('should mark active project', async () => {
    stateManager.setActiveProject('12345', 'test-project');

    const handler = createProjectsHandler(config, stateManager);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    const sentText = mockedSendWithMarkdown.mock.calls[0][1];
    expect(sentText).toContain('✅');
  });

  it('should reply with no projects message when config has none', async () => {
    const emptyConfig = createMockConfig({ projects: {} });
    const handler = createProjectsHandler(emptyConfig, stateManager);
    const ctx = createMockContext({ chatId: 12345 });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Nenhum projeto configurado'));
  });
});

describe('project command (select)', () => {
  let stateManager: StateManager;
  let registry: AdapterRegistry;
  let mockAdapter: ReturnType<typeof createMockAdapter>;
  const config = createMockConfig();

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
    registry = new AdapterRegistry();
    mockAdapter = createMockAdapter('claude');
    registry.register(mockAdapter);
  });

  it('should show usage when no project name given', async () => {
    const handler = createProjectHandler(config, stateManager, registry);
    const ctx = createMockContext({ match: '' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Uso:'));
  });

  it('should set active project when valid name is given', async () => {
    const handler = createProjectHandler(config, stateManager, registry);
    const ctx = createMockContext({ chatId: 12345, match: 'test-project' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Projeto ativo: test-project'));
    expect(stateManager.getActiveProject('12345')).toBe('test-project');
  });

  it('should reply with error for unknown project', async () => {
    const handler = createProjectHandler(config, stateManager, registry);
    const ctx = createMockContext({ chatId: 12345, match: 'nonexistent' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao encontrado'));
  });

  it('should select project by number', async () => {
    const handler = createProjectHandler(config, stateManager, registry);
    const ctx = createMockContext({ chatId: 12345, match: '1' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Projeto ativo: test-project'));
    expect(stateManager.getActiveProject('12345')).toBe('test-project');
  });

  it('should reject out-of-range number', async () => {
    const handler = createProjectHandler(config, stateManager, registry);
    const ctx = createMockContext({ chatId: 12345, match: '99' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao encontrado'));
  });

  it('should warn if adapter is not available', async () => {
    mockAdapter.isAvailable.mockResolvedValue(false);

    const handler = createProjectHandler(config, stateManager, registry);
    const ctx = createMockContext({ chatId: 12345, match: 'test-project' });

    await handler(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao encontrada'));
  });
});
