import type { Context } from 'grammy';
import type { SessionManager } from './sessions/manager.js';
import type { DevBridgeConfig } from './types.js';
import { getAdapter } from './adapters/index.js';
import { splitMessage, sendWithMarkdown, withTypingIndicator } from './utils/telegram.js';
import { logger } from './utils/logger.js';

export function createChatHandler(sessionManager: SessionManager, config: DevBridgeConfig) {
  return async (ctx: Context) => {
    const message = ctx.message?.text;
    if (!message) return;

    const { project, defaults } = config;

    try {
      const session = sessionManager.getOrCreate(
        project.name,
        project.path,
        project.adapter
      );

      const adapter = getAdapter(project.adapter);

      const response = await withTypingIndicator(ctx, () =>
        adapter.chat(message, session.cliSessionId, {
          model: project.model,
          timeout: defaults.timeout,
        })
      );

      // Update session stats
      sessionManager.update(session.id, {
        messageCount: session.messageCount + 1,
        lastMessageAt: new Date().toISOString(),
      });

      // Split and send response
      const chunks = splitMessage(response, defaults.max_message_length);
      for (const chunk of chunks) {
        await sendWithMarkdown(ctx, chunk);
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      logger.error('Chat handler error', { error: errorMessage });

      // If session is corrupted, auto-clear and suggest retry
      if (errorMessage.includes('corrompida')) {
        sessionManager.clearByProject(project.name);
      }

      await ctx.reply(errorMessage);
    }
  };
}
