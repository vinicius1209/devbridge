import { loadConfig } from './config.js';
import { createBot } from './bot.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('DevBridge v0.5 starting...');

  const config = loadConfig();
  const projectCount = Object.keys(config.projects).length;
  logger.info(`${projectCount} project(s) configured`);

  const { bot, registry, pluginLoader, notificationServer } = await createBot(config);

  // Check available adapters
  const available = await registry.getAvailable();
  if (available.length === 0) {
    logger.error('Nenhuma CLI de AI encontrada. Instale Claude CLI ou Gemini CLI.');
    process.exit(1);
  }

  logger.info(`Available adapters: ${available.map(a => a.name).join(', ')}`);

  // Warn about configured adapters that aren't available
  for (const [name, proj] of Object.entries(config.projects)) {
    try {
      const adapter = registry.get(proj.adapter);
      const isAvail = await adapter.isAvailable();
      if (!isAvail) {
        logger.warn(`Project "${name}" uses ${proj.adapter} but it's not installed`);
      }
    } catch {
      logger.warn(`Project "${name}" uses unknown adapter: ${proj.adapter}`);
    }
  }

  // Start notification server if enabled
  if (notificationServer) {
    try {
      await notificationServer.start();
    } catch (err) {
      logger.error('Failed to start notification server', { error: (err as Error).message });
    }
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    if (notificationServer) {
      await notificationServer.stop();
    }
    await pluginLoader.unloadAll();
    bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Bot starting with long polling...');
  await bot.start({
    onStart: () => {
      logger.info('DevBridge bot is running! Send a message on Telegram to test.');
    },
  });
}

main().catch((err) => {
  logger.error('Fatal error', { error: err.message });
  process.exit(1);
});
