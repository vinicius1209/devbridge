import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHelpHandler, handleHelp } from '../../../src/commands/help.js';
import { PluginRegistry } from '../../../src/plugins/registry.js';
import { createMockContext } from '../../helpers/mock-telegram.js';

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

describe('help command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send help text with all available commands', async () => {
    const handler = createHelpHandler();
    const ctx = createMockContext();

    await handler(ctx as any);

    expect(mockedSendWithMarkdown).toHaveBeenCalled();
    const sentText = mockedSendWithMarkdown.mock.calls[0][1];
    expect(sentText).toContain('/help');
    expect(sentText).toContain('/projects');
    expect(sentText).toContain('/clear');
    expect(sentText).toContain('/status');
    expect(sentText).toContain('/run');
  });

  it('should include plugin commands when plugin registry is provided', async () => {
    const pluginRegistry = new PluginRegistry();
    pluginRegistry.register({
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      commands: [
        {
          name: 'deploy',
          description: 'Deploy the project',
          handler: vi.fn(),
        },
      ],
      onLoad: vi.fn(),
      onUnload: vi.fn(),
    });

    const handler = createHelpHandler(pluginRegistry);
    const ctx = createMockContext();

    await handler(ctx as any);

    const sentText = mockedSendWithMarkdown.mock.calls[0][1];
    expect(sentText).toContain('deploy');
    expect(sentText).toContain('Deploy the project');
    expect(sentText).toContain('test-plugin');
  });

  it('should not show plugin section when no plugin commands', async () => {
    const pluginRegistry = new PluginRegistry();

    const handler = createHelpHandler(pluginRegistry);
    const ctx = createMockContext();

    await handler(ctx as any);

    const sentText = mockedSendWithMarkdown.mock.calls[0][1];
    expect(sentText).not.toContain('Comandos de plugins');
  });

  it('handleHelp backward compat function should work', async () => {
    const ctx = createMockContext();

    await handleHelp(ctx as any);

    expect(mockedSendWithMarkdown).toHaveBeenCalled();
  });
});
