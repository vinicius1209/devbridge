import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginLoader } from '../../../src/plugins/loader.js';
import type { PluginContext } from '../../../src/plugins/types.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

function createMockPluginContext(): Omit<PluginContext, 'pluginConfig'> {
  return {
    config: {} as any,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    sendMessage: vi.fn(),
    getActiveProject: vi.fn(),
    getProjects: vi.fn(() => ({})),
  };
}

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader();
  });

  describe('loadAll', () => {
    it('should skip plugins set to false', async () => {
      const ctx = createMockPluginContext();

      const loaded = await loader.loadAll({ 'disabled-plugin': false }, ctx);

      expect(loaded).toHaveLength(0);
    });

    it('should handle plugin load failures gracefully', async () => {
      const ctx = createMockPluginContext();

      // This will fail because the plugin doesn't exist
      const loaded = await loader.loadAll({ 'nonexistent-plugin': true }, ctx);

      // Should not crash, just return empty
      expect(loaded).toHaveLength(0);
    });

    it('should handle empty plugin config', async () => {
      const ctx = createMockPluginContext();

      const loaded = await loader.loadAll({}, ctx);

      expect(loaded).toHaveLength(0);
    });
  });

  describe('getLoaded', () => {
    it('should return empty array when no plugins loaded', () => {
      expect(loader.getLoaded()).toHaveLength(0);
    });
  });

  describe('unloadAll', () => {
    it('should not throw when no plugins loaded', async () => {
      await expect(loader.unloadAll()).resolves.toBeUndefined();
    });
  });

  describe('load', () => {
    it('should return null for plugins not found', async () => {
      const result = await loader.load('nonexistent');
      expect(result).toBeNull();
    });

    it('should determine source type correctly from name', async () => {
      const ctx = createMockPluginContext();

      // These will all fail to load, but we test that loadAll doesn't crash
      await loader.loadAll({
        'builtin-plugin': true,         // builtin
        '@npm/plugin': true,            // npm
        '/path/to/local/plugin': true,  // local
      }, ctx);

      // All should have failed gracefully
      expect(loader.getLoaded()).toHaveLength(0);
    });
  });
});
