import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DevBridgePlugin, LoadedPlugin, PluginContext } from './types.js';
import { logger } from '../utils/logger.js';

export class PluginLoader {
  private loaded: LoadedPlugin[] = [];

  async loadAll(pluginsConfig: Record<string, boolean | Record<string, unknown>>, context: Omit<PluginContext, 'pluginConfig'>): Promise<LoadedPlugin[]> {
    for (const [name, config] of Object.entries(pluginsConfig)) {
      if (config === false) continue;

      const pluginConfig = typeof config === 'object' ? config : {};

      try {
        const plugin = await this.load(name);
        if (plugin) {
          await plugin.onLoad({ ...context, pluginConfig });
          this.loaded.push({
            plugin,
            source: name.startsWith('/') ? 'local' : name.startsWith('@') ? 'npm' : 'builtin',
            path: name,
          });
          logger.info(`Plugin loaded: ${plugin.name} v${plugin.version}`);
        }
      } catch (err) {
        logger.error(`Failed to load plugin ${name}`, { error: (err as Error).message });
        // Don't prevent boot — isolate plugin errors
      }
    }

    return this.loaded;
  }

  async load(name: string): Promise<DevBridgePlugin | null> {
    // Try builtin plugins
    const builtinPath = resolve(import.meta.dirname ?? '.', '../../plugins', name.replace('@devbridge/plugin-', ''), 'dist/index.js');
    if (existsSync(builtinPath)) {
      const mod = await import(pathToFileURL(builtinPath).href);
      return mod.default as DevBridgePlugin;
    }

    // Try local path
    if (name.startsWith('/')) {
      const localPath = join(name, 'dist/index.js');
      if (existsSync(localPath)) {
        const mod = await import(pathToFileURL(localPath).href);
        return mod.default as DevBridgePlugin;
      }
    }

    // Try npm package
    try {
      const mod = await import(name);
      return mod.default as DevBridgePlugin;
    } catch {
      logger.warn(`Plugin ${name} not found in any source`);
      return null;
    }
  }

  async unloadAll(): Promise<void> {
    for (const { plugin } of this.loaded) {
      try {
        await plugin.onUnload();
        logger.info(`Plugin unloaded: ${plugin.name}`);
      } catch (err) {
        logger.error(`Error unloading ${plugin.name}`, { error: (err as Error).message });
      }
    }
    this.loaded = [];
  }

  getLoaded(): LoadedPlugin[] {
    return [...this.loaded];
  }
}
