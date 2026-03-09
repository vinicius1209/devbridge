import type { Context } from 'grammy';
import type { NotificationFilter } from '../notifications/filters.js';

export function createNotificationsHandler(filter: NotificationFilter) {
  return async (ctx: Context) => {
    const arg = ctx.match?.toString().trim().toLowerCase();

    if (arg === 'off') {
      filter.mute(999999); // Effectively disable
      await ctx.reply('Notificacoes desativadas.');
      return;
    }

    if (arg === 'on') {
      filter.unmute();
      await ctx.reply('Notificacoes ativadas.');
      return;
    }

    const status = filter.isMuted() ? 'desativadas' : 'ativas';
    await ctx.reply(`Notificacoes estao ${status}.`);
  };
}
