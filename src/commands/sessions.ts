import type { Context } from 'grammy';
import type { SessionManager } from '../sessions/manager.js';
import type { StateManager } from '../state.js';
import type { DevBridgeConfig } from '../types.js';
import { sendWithMarkdown } from '../utils/telegram.js';
import { resolveProjectByNameOrIndex } from '../utils/project-resolver.js';

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
    text += '\nUse /switch <numero ou nome> para alternar.';

    await sendWithMarkdown(ctx, text);
  };
}

export function createSwitchHandler(
  config: DevBridgeConfig,
  stateManager: StateManager
) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const input = ctx.match?.toString().trim();

    if (!input) {
      await ctx.reply('Uso: /switch <numero ou nome>');
      return;
    }

    const resolved = resolveProjectByNameOrIndex(input, config.projects);
    if (!resolved) {
      const entries = Object.entries(config.projects);
      const list = entries.map(([n], i) => `${i + 1}. ${n}`).join('\n');
      await ctx.reply(`Projeto "${input}" nao encontrado.\n\n${list}`);
      return;
    }

    stateManager.setActiveProject(chatId, resolved.name);
    await ctx.reply(`Projeto ativo: ${resolved.name}`);
  };
}
