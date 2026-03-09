import type { Context } from 'grammy';
import type { SessionManager } from '../sessions/manager.js';
import type { StateManager } from '../state.js';
import type { DevBridgeConfig } from '../types.js';
import { sendWithMarkdown } from '../utils/telegram.js';

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `ha ${days} dia(s)`;
  if (hours > 0) return `ha ${hours} hora(s)`;
  if (minutes > 0) return `ha ${minutes} minuto(s)`;
  return 'agora mesmo';
}

export function createStatusHandler(
  sessionManager: SessionManager,
  stateManager: StateManager,
  config: DevBridgeConfig
) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const activeProject = stateManager.getActiveProject(chatId);

    if (!activeProject) {
      await ctx.reply('Nenhum projeto ativo. Use /projects para ver disponiveis.');
      return;
    }

    const project = config.projects[activeProject];
    const session = sessionManager.getByProject(activeProject);

    if (!session) {
      await ctx.reply(`Projeto ativo: ${activeProject}\nNenhuma sessao. Envie uma mensagem para iniciar.`);
      return;
    }

    const model = project?.model ?? config.defaults.model ?? 'default';
    const text = `Projeto: ${session.projectName}
Adapter: ${session.adapter} (${model})
Sessao: ${session.id.slice(0, 8)} (${session.messageCount} mensagens)
Iniciada: ${timeAgo(session.createdAt)}
Ultima msg: ${timeAgo(session.lastMessageAt)}`;

    await sendWithMarkdown(ctx, text);
  };
}
