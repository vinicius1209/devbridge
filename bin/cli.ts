#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { init } from '../src/cli/init.js';
import { createServiceManager } from '../src/cli/service.js';
import { logger } from '../src/utils/logger.js';

const { positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

async function main() {
  switch (command) {
    case 'init':
      await init();
      break;
    case 'start': {
      const { loadConfig } = await import('../src/config.js');
      const { createBot } = await import('../src/bot.js');
      const config = loadConfig();
      const { bot } = await createBot(config);
      logger.info('DevBridge starting in foreground...');
      await bot.start({ onStart: () => logger.info('Bot running!') });
      break;
    }
    case 'stop': {
      const svc = createServiceManager();
      await svc.stop();
      console.log('DevBridge parado.');
      break;
    }
    case 'logs': {
      const hasFollow = process.argv.includes('-f');
      const svc = createServiceManager();
      const logs = await svc.getLogs(50);
      console.log(logs);
      if (hasFollow) {
        const { spawn } = await import('node:child_process');
        const { join } = await import('node:path');
        const { homedir } = await import('node:os');
        const logPath = join(homedir(), '.devbridge', 'logs', 'devbridge.log');
        spawn('tail', ['-f', logPath], { stdio: 'inherit' });
      }
      break;
    }
    case 'status': {
      const svc = createServiceManager();
      const running = await svc.isRunning();
      console.log(`DevBridge v0.3.0`);
      console.log(`Status: ${running ? 'ativo' : 'parado'}`);
      break;
    }
    default:
      console.log(`DevBridge CLI

Comandos:
  devbridge init    — Setup wizard interativo
  devbridge start   — Inicia o bot em foreground
  devbridge stop    — Para o servico
  devbridge logs    — Mostra logs recentes (-f para follow)
  devbridge status  — Status do servico`);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
