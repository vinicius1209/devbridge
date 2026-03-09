import type { Context } from 'grammy';
import type { PluginLoader } from '../plugins/loader.js';
import { sendWithMarkdown } from '../utils/telegram.js';

export function createPluginsHandler(loader: PluginLoader) {
  return async (ctx: Context) => {
    const loaded = loader.getLoaded();

    if (loaded.length === 0) {
      await ctx.reply('Nenhum plugin carregado.');
      return;
    }

    let text = 'Plugins carregados:\n';
    for (const { plugin, source } of loaded) {
      text += `  ${plugin.name} v${plugin.version} (${source}) — ${plugin.description}\n`;
    }

    await sendWithMarkdown(ctx, text);
  };
}
