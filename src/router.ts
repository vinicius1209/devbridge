import type { Context } from 'grammy';
import type { SessionManager } from './sessions/manager.js';
import type { StateManager } from './state.js';
import type { AdapterRegistry } from './adapters/index.js';
import type { DevBridgeConfig, ChatResult } from './types.js';
import { splitMessage, sendWithMarkdown, withTypingIndicator } from './utils/telegram.js';
import { logger } from './utils/logger.js';

const CONTEXT_WARNING_THRESHOLD = 50;

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

      let result: ChatResult;

      try {
        result = await withTypingIndicator(ctx, () =>
          adapter.chat(message, session.cliSessionId, {
            model,
            timeout: config.defaults.timeout,
            cwd: project.path,
          })
        );
      } catch (err) {
        const errorMsg = (err as Error).message;

        // Auto-recovery: if session expired and we had a CLI session, retry without it
        if (errorMsg === 'SESSION_EXPIRED' && session.cliSessionId) {
          logger.info('Session expired, auto-recovering', { project: activeProject });
          await ctx.reply('Sessao anterior expirou. Reiniciando conversa...');

          sessionManager.update(session.id, { cliSessionId: null });

          result = await withTypingIndicator(ctx, () =>
            adapter.chat(message, null, {
              model,
              timeout: config.defaults.timeout,
              cwd: project.path,
            })
          );
        } else {
          throw err;
        }
      }

      sessionManager.update(session.id, {
        cliSessionId: result.sessionId,
        messageCount: session.messageCount + 1,
        lastMessageAt: new Date().toISOString(),
      });

      // Context warning
      if (session.messageCount + 1 === CONTEXT_WARNING_THRESHOLD) {
        await ctx.reply(`Aviso: ${CONTEXT_WARNING_THRESHOLD} mensagens nesta sessao. Use /clear para comecar do zero se necessario.`);
      }

      const chunks = splitMessage(result.text, config.defaults.max_message_length);
      for (const chunk of chunks) {
        await sendWithMarkdown(ctx, chunk);
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      logger.error('Chat handler error', { error: errorMessage });

      if (errorMessage === 'SESSION_EXPIRED') {
        sessionManager.clearByProject(activeProject);
        await ctx.reply('Sessao corrompida. Use /clear para iniciar nova conversa.');
        return;
      }

      await ctx.reply(errorMessage);
    }
  };
}
