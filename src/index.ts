import { loadConfig } from './config.js';
import { createBot } from './bot.js';
import { getAdapter } from './adapters/index.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('DevBridge v0.1 starting...');

  // Load config
  const config = loadConfig();
  logger.info(`Project: ${config.project.name} (${config.project.path})`);

  // Verify Claude CLI is available
  const adapter = getAdapter(config.project.adapter);
  const isAvailable = await adapter.isAvailable();

  if (!isAvailable) {
    logger.error('Claude CLI nao encontrada. Instale em https://claude.ai/code');
    process.exit(1);
  }

  logger.info('Claude CLI detected');

  // Create and start bot
  const bot = createBot(config);

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
