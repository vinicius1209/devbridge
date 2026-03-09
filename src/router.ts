import type { Context } from 'grammy';
import type { SessionManager } from './sessions/manager.js';
import type { StateManager } from './state.js';
import type { AdapterRegistry } from './adapters/index.js';
import type { DevBridgeConfig } from './types.js';
import { splitMessage, sendWithMarkdown, withTypingIndicator } from './utils/telegram.js';
import { logger } from './utils/logger.js';

export function createChatHandler(
  sessionManager: SessionManager,
  stateManager: StateManager,
  registry: AdapterRegistry,
  config: DevBridgeConfig
) {
  return async (ctx: Context) => {
    const message = ctx.message?.text;
    if (!message) return;

    const chatId = ctx.chat?.id?.toString() ?? '';
    const activeProject = stateManager.getActiveProject(chatId);

    if (!activeProject) {
      await ctx.reply('Nenhum projeto ativo. Use /projects para ver disponiveis.');
      return;
    }

    const project = config.projects[activeProject];
    if (!project) {
      await ctx.reply('Projeto ativo nao encontrado no config. Use /projects.');
      return;
    }

    try {
      const session = sessionManager.getOrCreate(
        activeProject,
        project.path,
        project.adapter
      );

      const adapter = registry.get(project.adapter);
      const model = project.model ?? config.defaults.model;

      const response = await withTypingIndicator(ctx, () =>
        adapter.chat(message, session.cliSessionId, {
          model,
          timeout: config.defaults.timeout,
          cwd: project.path,
        })
      );

      sessionManager.update(session.id, {
        messageCount: session.messageCount + 1,
        lastMessageAt: new Date().toISOString(),
      });

      const chunks = splitMessage(response, config.defaults.max_message_length);
      for (const chunk of chunks) {
        await sendWithMarkdown(ctx, chunk);
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      logger.error('Chat handler error', { error: errorMessage });

      if (errorMessage.includes('corrompida')) {
        sessionManager.clearByProject(activeProject);
      }

      await ctx.reply(errorMessage);
    }
  };
}
