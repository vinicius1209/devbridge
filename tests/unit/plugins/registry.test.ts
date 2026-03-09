import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginRegistry } from '../../../src/plugins/registry.js';
import type { DevBridgePlugin, PluginCommand } from '../../../src/plugins/types.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockPlugin(name: string, commands: PluginCommand[]): DevBridgePlugin {
  return {
    name,
    version: '1.0.0',
    description: `${name} plugin`,
    commands,
    onLoad: vi.fn().mockResolvedValue(undefined),
    onUnload: vi.fn().mockResolvedValue(undefined),
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register plugin commands', () => {
      const plugin = createMockPlugin('test-plugin', [
        { name: 'deploy', description: 'Deploy project', handler: vi.fn() },
      ]);

      registry.register(plugin);

      expect(registry.listCommands()).toHaveLength(1);
      expect(registry.listCommands()[0].command).toBe('deploy');
    });

    it('should register multiple commands from one plugin', () => {
      const plugin = createMockPlugin('test-plugin', [
        { name: 'deploy', description: 'Deploy project', handler: vi.fn() },
        { name: 'rollback', description: 'Rollback deploy', handler: vi.fn() },
      ]);

      registry.register(plugin);

      expect(registry.listCommands()).toHaveLength(2);
    });

    it('should skip conflicting commands (keep first)', () => {
      const plugin1 = createMockPlugin('plugin-a', [
        { name: 'deploy', description: 'Deploy from A', handler: vi.fn() },
      ]);

      const plugin2 = createMockPlugin('plugin-b', [
        { name: 'deploy', description: 'Deploy from B', handler: vi.fn() },
      ]);

      registry.register(plugin1);
      registry.register(plugin2);

      expect(registry.listCommands()).toHaveLength(1);
      expect(registry.listCommands()[0].plugin).toBe('plugin-a');
    });
  });

  describe('resolve', () => {
    it('should return plugin command by name', () => {
      const handler = vi.fn();
      const plugin = createMockPlugin('test-plugin', [
        { name: 'deploy', description: 'Deploy project', handler },
      ]);

      registry.register(plugin);

      const cmd = registry.resolve('deploy');
      expect(cmd).not.toBeNull();
      expect(cmd?.name).toBe('deploy');
      expect(cmd?.handler).toBe(handler);
    });

    it('should return null for unregistered command', () => {
      expect(registry.resolve('unknown')).toBeNull();
    });
  });

  describe('listCommands', () => {
    it('should return all registered commands with metadata', () => {
      const plugin = createMockPlugin('my-plugin', [
        { name: 'cmd1', description: 'Command 1', handler: vi.fn() },
        { name: 'cmd2', description: 'Command 2', handler: vi.fn() },
      ]);

      registry.register(plugin);

      const commands = registry.listCommands();
      expect(commands).toEqual([
        { command: 'cmd1', plugin: 'my-plugin', description: 'Command 1' },
        { command: 'cmd2', plugin: 'my-plugin', description: 'Command 2' },
      ]);
    });

    it('should return empty array when no commands registered', () => {
      expect(registry.listCommands()).toEqual([]);
    });
  });

  describe('hasConflict', () => {
    it('should return true for existing command', () => {
      const plugin = createMockPlugin('test-plugin', [
        { name: 'deploy', description: 'Deploy', handler: vi.fn() },
      ]);

      registry.register(plugin);

      expect(registry.hasConflict('deploy')).toBe(true);
    });

    it('should return false for non-existing command', () => {
      expect(registry.hasConflict('deploy')).toBe(false);
    });
  });
});
