import { Bot } from 'grammy';
import type { DevBridgeConfig } from './types.js';
import { createDefaultRegistry, type AdapterRegistry } from './adapters/index.js';
import { SessionManager } from './sessions/manager.js';
import { StateManager } from './state.js';
import { createAuthMiddleware } from './security/auth.js';
import { handleHelp } from './commands/help.js';
import { createClearHandler } from './commands/clear.js';
import { createStatusHandler } from './commands/status.js';
import { createProjectsHandler, createProjectHandler } from './commands/projects.js';
import { createSessionsHandler, createSwitchHandler } from './commands/sessions.js';
import { createRunHandler } from './commands/run.js';
import { createChatHandler } from './router.js';
import { logger } from './utils/logger.js';

export interface BotDeps {
  bot: Bot;
  registry: AdapterRegistry;
  sessionManager: SessionManager;
  stateManager: StateManager;
}

export function createBot(config: DevBridgeConfig): BotDeps {
  const bot = new Bot(config.telegram.bot_token);
  const registry = createDefaultRegistry();
  const sessionManager = new SessionManager(registry);
  const stateManager = new StateManager();

  // Cleanup expired sessions
  sessionManager.cleanup(config.defaults.session_ttl_hours);

  // Auto-select project if only one configured
  const projectNames = Object.keys(config.projects);
  if (projectNames.length === 1) {
    // Will be auto-selected for each user on first message
    logger.info(`Single project configured: ${projectNames[0]} (auto-select)`);
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

  // Commands
  bot.command('help', handleHelp);
  bot.command('start', handleHelp);
  bot.command('clear', createClearHandler(sessionManager, stateManager, config));
  bot.command('status', createStatusHandler(sessionManager, stateManager, config));
  bot.command('projects', createProjectsHandler(config, stateManager));
  bot.command('project', createProjectHandler(config, stateManager, registry));
  bot.command('sessions', createSessionsHandler(sessionManager));
  bot.command('switch', createSwitchHandler(config, stateManager));
  bot.command('run', createRunHandler(config, stateManager));

  // Chat handler
  bot.on('message:text', createChatHandler(sessionManager, stateManager, registry, config));

  // Error handler
  bot.catch((err) => {
    logger.error('Bot error', { error: err.message });
  });

  return { bot, registry, sessionManager, stateManager };
}
