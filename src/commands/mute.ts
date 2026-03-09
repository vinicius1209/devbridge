import type { Context } from 'grammy';
import type { NotificationFilter } from '../notifications/filters.js';

export function createMuteHandler(filter: NotificationFilter) {
  return async (ctx: Context) => {
    const arg = ctx.match?.toString().trim();

    if (!arg) {
      await ctx.reply('Uso: /mute <minutos>\nExemplo: /mute 60');
      return;
    }

    const minutes = parseInt(arg, 10);
    if (isNaN(minutes) || minutes <= 0) {
      await ctx.reply('Informe um numero positivo de minutos.');
      return;
    }

    filter.mute(minutes);
    const until = new Date(Date.now() + minutes * 60000);
    const timeStr = until.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    await ctx.reply(`Notificacoes silenciadas por ${minutes} minutos (ate ${timeStr}).`);
  };
}
