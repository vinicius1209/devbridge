import type { Context } from 'grammy';
import type { SessionManager } from '../sessions/manager.js';
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

export function createStatusHandler(sessionManager: SessionManager, config: DevBridgeConfig) {
  return async (ctx: Context) => {
    const session = sessionManager.getByProject(config.project.name);

    if (!session) {
      await ctx.reply('Nenhuma sessao ativa. Envie uma mensagem para iniciar.');
      return;
    }

    const model = config.project.model ?? 'default';
    const text = `Projeto: ${session.projectName}
Adapter: Claude (${model})
Sessao: ${session.id.slice(0, 8)} (${session.messageCount} mensagens)
Iniciada: ${timeAgo(session.createdAt)}
Ultima msg: ${timeAgo(session.lastMessageAt)}`;

    await sendWithMarkdown(ctx, text);
  };
}
