import { describe, it, expect, vi } from 'vitest';
import { createPluginsHandler } from '../../../src/commands/plugins.js';
import { createMockContext } from '../../helpers/mock-telegram.js';

describe('plugins command', () => {
  it('shows message when no plugins loaded', async () => {
    const loader = { getLoaded: vi.fn().mockReturnValue([]) };
    const handler = createPluginsHandler(loader as any);
    const ctx = createMockContext();
    await handler(ctx as any);
    expect(ctx.reply).toHaveBeenCalledWith('Nenhum plugin carregado.');
  });

  it('lists loaded plugins with details', async () => {
    const loader = {
      getLoaded: vi.fn().mockReturnValue([
        {
          plugin: { name: 'test-plugin', version: '1.0.0', description: 'A test plugin', commands: [] },
          source: 'builtin',
        },
        {
          plugin: { name: 'other-plugin', version: '2.0.0', description: 'Another plugin', commands: [] },
          source: 'npm',
        },
      ]),
    };
    const handler = createPluginsHandler(loader as any);
    const ctx = createMockContext();
    await handler(ctx as any);
    // sendWithMarkdown calls ctx.reply with parse_mode
    expect(ctx.reply).toHaveBeenCalled();
  });
});
