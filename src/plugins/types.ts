import type { DevBridgeConfig, ProjectConfig, CommandResult } from '../types.js';

export interface DevBridgePlugin {
  name: string;
  version: string;
  description: string;
  commands: PluginCommand[];
  onLoad(context: PluginContext): Promise<void>;
  onUnload(): Promise<void>;
}

export interface PluginCommand {
  name: string;
  description: string;
  subcommands?: string[];
  handler(ctx: CommandContext): Promise<void>;
}

export interface CommandContext {
  args: string[];
  rawArgs: string;
  project: ProjectConfig & { name: string };
  reply(text: string): Promise<void>;
  withTyping<T>(fn: () => Promise<T>): Promise<T>;
  exec(command: string, args?: string[]): Promise<CommandResult>;
  chatId: string;
}

export interface PluginContext {
  config: DevBridgeConfig;
  pluginConfig: Record<string, unknown>;
  logger: {
    info(msg: string, meta?: unknown): void;
    warn(msg: string, meta?: unknown): void;
    error(msg: string, meta?: unknown): void;
    debug(msg: string, meta?: unknown): void;
  };
  sendMessage(chatId: string, text: string): Promise<void>;
  getActiveProject(chatId: string): (ProjectConfig & { name: string }) | null;
  getProjects(): Record<string, ProjectConfig>;
}

export interface LoadedPlugin {
  plugin: DevBridgePlugin;
  source: 'builtin' | 'npm' | 'local';
  path: string;
}
