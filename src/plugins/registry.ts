import type { PluginCommand, DevBridgePlugin } from './types.js';
import { logger } from '../utils/logger.js';

interface RegisteredCommand {
  command: PluginCommand;
  pluginName: string;
}

export class PluginRegistry {
  private commands = new Map<string, RegisteredCommand>();

  register(plugin: DevBridgePlugin): void {
    for (const cmd of plugin.commands) {
      if (this.commands.has(cmd.name)) {
        const existing = this.commands.get(cmd.name);
        logger.warn(`Command /${cmd.name} conflict: ${plugin.name} vs ${existing?.pluginName}. Keeping first.`);
        continue;
      }
      this.commands.set(cmd.name, { command: cmd, pluginName: plugin.name });
    }
  }

  resolve(commandName: string): PluginCommand | null {
    return this.commands.get(commandName)?.command ?? null;
  }

  listCommands(): Array<{ command: string; plugin: string; description: string }> {
    return [...this.commands.entries()].map(([name, reg]) => ({
      command: name,
      plugin: reg.pluginName,
      description: reg.command.description,
    }));
  }

  hasConflict(commandName: string): boolean {
    return this.commands.has(commandName);
  }
}
