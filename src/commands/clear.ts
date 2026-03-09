import type { Context } from 'grammy';
import type { SessionManager } from '../sessions/manager.js';
import type { StateManager } from '../state.js';
import type { DevBridgeConfig } from '../types.js';

export function createClearHandler(
  sessionManager: SessionManager,
  stateManager: StateManager,
  _config: DevBridgeConfig
) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const activeProject = stateManager.getActiveProject(chatId);

    if (!activeProject) {
      await ctx.reply('Nenhum projeto ativo. Nada para limpar.');
      return;
    }

    sessionManager.clearByProject(activeProject);
    await ctx.reply('Sessao limpa. Proxima mensagem inicia uma nova conversa.');
  };
}
