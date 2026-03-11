import type { Context } from 'grammy';
import type { SessionManager } from './sessions/manager.js';
import type { StateManager } from './state.js';
import type { AdapterRegistry } from './adapters/index.js';
import type { DevBridgeConfig, ChatResult, CLIAdapter, StreamChatOptions } from './types.js';
import { resolvePermissions } from './adapters/permissions.js';
import { splitMessage, sendWithMarkdown, withTypingIndicator } from './utils/telegram.js';
import { logger } from './utils/logger.js';

const CONTEXT_WARNING_THRESHOLD = 50;
const STREAM_MIN_CHUNK_SIZE = 100;

export function createChatHandler(
  sessionManager: SessionManager,
  stateManager: StateManager,
  registry: AdapterRegistry,
  config: DevBridgeConfig,
) {
  function buildStreamOptions(
    ctx: Context,
    message: string,
    sessionId: string | null,
    projectPath: string,
    model: string | undefined,
    allowedTools: string | undefined,
    skipPermissions: boolean | undefined,
  ): StreamChatOptions & { cwd: string } {
    return {
      model,
      timeout: config.defaults.stream_timeout,
      inactivityTimeout: config.defaults.inactivity_timeout,
      allowedTools,
      skipPermissions,
      cwd: projectPath,
      minChunkSize: STREAM_MIN_CHUNK_SIZE,
      onChunk: async (chunk: string) => {
        if (!chunk.trim()) return;

        const chunks = splitMessage(chunk, config.defaults.max_message_length);
        for (const textChunk of chunks) {
          try {
            await ctx.reply(textChunk);
          } catch (err) {
            logger.warn('Failed to send chunk', { error: (err as Error).message });
          }
        }
      },
    };
  }

  async function sendWithStreaming(
    ctx: Context,
    adapter: CLIAdapter,
    message: string,
    sessionId: string | null,
    projectPath: string,
    model: string | undefined,
    allowedTools: string | undefined,
    skipPermissions: boolean | undefined,
  ): Promise<ChatResult> {
    return await withTypingIndicator(ctx, async () => {
      const chatStream = adapter.chatStream;
      if (!chatStream) {
        throw new Error('chatStream not available');
      }
      const opts = buildStreamOptions(
        ctx,
        message,
        sessionId,
        projectPath,
        model,
        allowedTools,
        skipPermissions,
      );
      return await chatStream.call(adapter, message, sessionId, opts);
    });
  }

  async function sendWithoutStreaming(
    ctx: Context,
    adapter: CLIAdapter,
    message: string,
    sessionId: string | null,
    projectPath: string,
    model: string | undefined,
    allowedTools: string | undefined,
    skipPermissions: boolean | undefined,
  ): Promise<ChatResult> {
    return await withTypingIndicator(ctx, () =>
      adapter.chat(message, sessionId, {
        model,
        timeout: config.defaults.timeout,
        allowedTools,
        skipPermissions,
        cwd: projectPath,
      }),
    );
  }

  return async (ctx: Context) => {
    const message = ctx.message?.text;
    if (!message) return;

    const chatId = ctx.chat?.id?.toString() ?? '';
    const username = ctx.from?.username ?? 'unknown';
    const userId = ctx.from?.id?.toString() ?? 'unknown';

    logger.info('Message received', {
      chatId,
      userId,
      username,
      messageLength: message.length,
      message: message.slice(0, 100),
    });

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

    const startTime = Date.now();

    try {
      const session = sessionManager.getOrCreate(activeProject, project.path, project.adapter);

      const adapter = registry.get(project.adapter);
      const model = project.model ?? config.defaults.model;
      const hasStreaming = adapter.chatStream !== undefined;
      const permissions = resolvePermissions(
        project.adapter,
        project.permission_level,
        project.allowed_tools,
        project.skip_permissions,
      );
      const { allowedTools, skipPermissions } = permissions;

      const sendFn = hasStreaming ? sendWithStreaming : sendWithoutStreaming;

      logger.debug('Processing message', {
        adapter: project.adapter,
        hasStreaming,
        project: activeProject,
        hasSession: !!session.cliSessionId,
        skipPermissions: !!skipPermissions,
        allowedTools: allowedTools ?? 'default',
      });

      let result: ChatResult;

      try {
        result = await sendFn(
          ctx,
          adapter,
          message,
          session.cliSessionId,
          project.path,
          model,
          allowedTools,
          skipPermissions,
        );
      } catch (err) {
        const errorMsg = (err as Error).message;

        if (errorMsg === 'SESSION_EXPIRED' && session.cliSessionId) {
          logger.info('Session expired, auto-recovering', { project: activeProject });
          await ctx.reply('Sessao anterior expirou. Reiniciando conversa...');

          sessionManager.update(session.id, { cliSessionId: null });

          result = await sendFn(
            ctx,
            adapter,
            message,
            null,
            project.path,
            model,
            allowedTools,
            skipPermissions,
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

      const durationMs = Date.now() - startTime;
      const responseLength = result.text.length;

      logger.info('Message processed successfully', {
        chatId,
        project: activeProject,
        adapter: project.adapter,
        streaming: hasStreaming,
        durationMs,
        responseLength,
        messageCount: session.messageCount + 1,
      });

      if (session.messageCount + 1 === CONTEXT_WARNING_THRESHOLD) {
        await ctx.reply(
          `Aviso: ${CONTEXT_WARNING_THRESHOLD} mensagens nesta sessao. Use /clear para comecar do zero se necessario.`,
        );
      }

      if (!hasStreaming) {
        const chunks = splitMessage(result.text, config.defaults.max_message_length);
        for (const chunk of chunks) {
          await sendWithMarkdown(ctx, chunk);
        }
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      const durationMs = Date.now() - startTime;

      logger.error('Chat handler error', {
        chatId,
        project: activeProject,
        error: errorMessage,
        durationMs,
      });

      if (errorMessage === 'SESSION_EXPIRED') {
        sessionManager.clearByProject(activeProject);
        await ctx.reply('Sessao corrompida. Use /clear para iniciar nova conversa.');
        return;
      }

      await ctx.reply(errorMessage);
    }
  };
}
