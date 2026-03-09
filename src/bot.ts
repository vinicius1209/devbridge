import { Bot } from 'grammy';
import type { DevBridgeConfig } from './types.js';
import { SessionManager } from './sessions/manager.js';
import { createAuthMiddleware } from './security/auth.js';
import { handleHelp } from './commands/help.js';
import { createClearHandler } from './commands/clear.js';
import { createStatusHandler } from './commands/status.js';
import { createChatHandler } from './router.js';
import { logger } from './utils/logger.js';

export function createBot(config: DevBridgeConfig): Bot {
  const bot = new Bot(config.telegram.bot_token);
  const sessionManager = new SessionManager();

  // Cleanup expired sessions
  sessionManager.cleanup(config.defaults.session_ttl_hours);

  // Auth middleware
  bot.use(createAuthMiddleware(config.telegram.allowed_users));

  // Commands
  bot.command('help', handleHelp);
  bot.command('start', handleHelp);
  bot.command('clear', createClearHandler(sessionManager, config));
  bot.command('status', createStatusHandler(sessionManager, config));

  // Chat handler (all text messages)
  bot.on('message:text', createChatHandler(sessionManager, config));

  // Error handler
  bot.catch((err) => {
    logger.error('Bot error', { error: err.message });
  });

  return bot;
}
