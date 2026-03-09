import { Bot } from 'grammy';
import type { DevBridgeConfig, ProjectConfig } from './types.js';
import { createDefaultRegistry, type AdapterRegistry } from './adapters/index.js';
import { SessionManager } from './sessions/manager.js';
import { StateManager } from './state.js';
import { createAuthMiddleware } from './security/auth.js';
import { createHelpHandler } from './commands/help.js';
import { createClearHandler } from './commands/clear.js';
import { createStatusHandler } from './commands/status.js';
import { createProjectsHandler, createProjectHandler } from './commands/projects.js';
import { createSessionsHandler, createSwitchHandler } from './commands/sessions.js';
import { createRunHandler } from './commands/run.js';
import { createPluginsHandler } from './commands/plugins.js';
import { createNotificationsHandler } from './commands/notifications.js';
import { createMuteHandler } from './commands/mute.js';
import { createChatHandler } from './router.js';
import { PluginLoader } from './plugins/loader.js';
import { PluginRegistry } from './plugins/registry.js';
import { createCommandContext } from './plugins/context.js';
import type { PluginContext } from './plugins/types.js';
import { NotificationServer } from './notifications/server.js';
import { getNotificationFilter } from './notifications/routes.js';
import { logger } from './utils/logger.js';

export interface BotDeps {
  bot: Bot;
  registry: AdapterRegistry;
  sessionManager: SessionManager;
  stateManager: StateManager;
  pluginLoader: PluginLoader;
  pluginRegistry: PluginRegistry;
  notificationServer?: NotificationServer;
}

export async function createBot(config: DevBridgeConfig): Promise<BotDeps> {
  const bot = new Bot(config.telegram.bot_token);
  const registry = createDefaultRegistry();
  const sessionManager = new SessionManager(registry);
  const stateManager = new StateManager();
  const pluginLoader = new PluginLoader();
  const pluginRegistry = new PluginRegistry();

  // Cleanup expired sessions
  sessionManager.cleanup(config.defaults.session_ttl_hours);

  // Auto-select project if only one configured
  const projectNames = Object.keys(config.projects);
  if (projectNames.length === 1) {
    logger.info(`Single project configured: ${projectNames[0]} (auto-select)`);
  }

  // Load plugins
  if (config.plugins && Object.keys(config.plugins).length > 0) {
    const pluginContext: Omit<PluginContext, 'pluginConfig'> = {
      config,
      logger,
      async sendMessage(chatId: string, text: string) {
        await bot.api.sendMessage(chatId, text);
      },
      getActiveProject(chatId: string): (ProjectConfig & { name: string }) | null {
        const name = stateManager.getActiveProject(chatId);
        if (!name) return null;
        const proj = config.projects[name];
        if (!proj) return null;
        return { ...proj, name };
      },
      getProjects(): Record<string, ProjectConfig> {
        return config.projects;
      },
    };

    const loaded = await pluginLoader.loadAll(config.plugins, pluginContext);
    for (const { plugin } of loaded) {
      pluginRegistry.register(plugin);
    }

    const pluginCmdCount = pluginRegistry.listCommands().length;
    logger.info(`${loaded.length} plugin(s) loaded, ${pluginCmdCount} command(s) registered`);
  }

  // Auth middleware
  bot.use(createAuthMiddleware(config.telegram.allowed_users));

  // Auto-select single project middleware
  bot.use(async (ctx, next) => {
    if (projectNames.length === 1) {
      const chatId = ctx.chat?.id?.toString() ?? '';
      if (!stateManager.getActiveProject(chatId)) {
        stateManager.setActiveProject(chatId, projectNames[0]);
      }
    }
    await next();
  });

  // Core commands
  const helpHandler = createHelpHandler(pluginRegistry);
  bot.command('help', helpHandler);
  bot.command('start', helpHandler);
  bot.command('clear', createClearHandler(sessionManager, stateManager, config));
  bot.command('status', createStatusHandler(sessionManager, stateManager, config));
  bot.command('projects', createProjectsHandler(config, stateManager));
  bot.command('project', createProjectHandler(config, stateManager, registry));
  bot.command('sessions', createSessionsHandler(sessionManager));
  bot.command('switch', createSwitchHandler(config, stateManager));
  bot.command('run', createRunHandler(config, stateManager));
  bot.command('plugins', createPluginsHandler(pluginLoader));

  // Notification commands + HTTP server
  let notificationServer: NotificationServer | undefined;

  if (config.notifications?.enabled) {
    const notifConfig = config.notifications;
    const filter = getNotificationFilter(notifConfig);

    bot.command('notifications', createNotificationsHandler(filter));
    bot.command('mute', createMuteHandler(filter));

    const sendMessage = async (chatId: string, text: string) => {
      await bot.api.sendMessage(chatId, text);
    };

    notificationServer = new NotificationServer(
      notifConfig.port,
      notifConfig,
      sendMessage,
      config.telegram.allowed_users
    );
  }

  // Register plugin command handlers
  for (const cmdInfo of pluginRegistry.listCommands()) {
    const pluginCmd = pluginRegistry.resolve(cmdInfo.command);
    if (pluginCmd) {
      bot.command(cmdInfo.command, async (ctx) => {
        const chatId = ctx.chat?.id?.toString() ?? '';
        const activeProjectName = stateManager.getActiveProject(chatId);

        if (!activeProjectName) {
          await ctx.reply('Nenhum projeto ativo. Use /projects para ver disponiveis.');
          return;
        }

        const project = config.projects[activeProjectName];
        if (!project) {
          await ctx.reply('Projeto ativo nao encontrado no config. Use /projects.');
          return;
        }

        const rawArgs = ctx.match?.toString().trim() ?? '';
        const args = rawArgs ? rawArgs.split(/\s+/) : [];
        const projectWithName = { ...project, name: activeProjectName };

        const cmdCtx = createCommandContext(ctx, args, rawArgs, projectWithName, chatId);

        try {
          await pluginCmd.handler(cmdCtx);
        } catch (err) {
          logger.error(`Plugin command /${cmdInfo.command} error`, { error: (err as Error).message });
          await ctx.reply(`Erro no plugin: ${(err as Error).message}`);
        }
      });
    }
  }

  // Chat handler (must be after all command registrations)
  bot.on('message:text', createChatHandler(sessionManager, stateManager, registry, config));

  // Error handler
  bot.catch((err) => {
    logger.error('Bot error', { error: err.message });
  });

  return { bot, registry, sessionManager, stateManager, pluginLoader, pluginRegistry, notificationServer };
}
