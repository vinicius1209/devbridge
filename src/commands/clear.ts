import type { Context } from 'grammy';
import type { SessionManager } from '../sessions/manager.js';
import type { DevBridgeConfig } from '../types.js';

export function createClearHandler(sessionManager: SessionManager, config: DevBridgeConfig) {
  return async (ctx: Context) => {
    sessionManager.clearByProject(config.project.name);
    await ctx.reply('Sessao limpa. Proxima mensagem inicia uma nova conversa.');
  };
}
