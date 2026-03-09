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
  if (minutes > 0) return `ha ${minutes} min`;
  return 'agora';
}

export function createSessionsHandler(sessionManager: SessionManager) {
  return async (ctx: Context) => {
    const sessions = sessionManager.listActive();

    if (sessions.length === 0) {
      await ctx.reply('Nenhuma sessao ativa.');
      return;
    }

    let text = 'Sessoes ativas:\n';
    sessions.forEach((s, i) => {
      text += `  ${i + 1}. ${s.projectName} (${s.adapter}, ${s.messageCount} msgs, ${timeAgo(s.lastMessageAt)})\n`;
    });
    text += '\nUse /switch <nome> para alternar.';

    await sendWithMarkdown(ctx, text);
  };
}

export function createSwitchHandler(
  config: DevBridgeConfig,
  stateManager: StateManager
) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const name = ctx.match?.toString().trim();

    if (!name) {
      await ctx.reply('Uso: /switch <nome_do_projeto>');
      return;
    }

    if (!config.projects[name]) {
      const available = Object.keys(config.projects).join(', ');
      await ctx.reply(`Projeto "${name}" nao encontrado. Disponiveis: ${available}`);
      return;
    }

    stateManager.setActiveProject(chatId, name);
    await ctx.reply(`Projeto ativo: ${name}`);
  };
}
