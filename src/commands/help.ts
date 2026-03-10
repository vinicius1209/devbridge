import type { Context } from 'grammy';
import type { PluginRegistry } from '../plugins/registry.js';
import { sendWithMarkdown } from '../utils/telegram.js';

export function createHelpHandler(pluginRegistry?: PluginRegistry) {
  return async (ctx: Context): Promise<void> => {
    let text = `*DevBridge v0.5*

Comandos disponiveis:
  /help           — Mostra esta mensagem
  /projects       — Lista projetos configurados
  /project <n>    — Troca projeto (numero ou nome)
  /sessions       — Lista sessoes ativas
  /switch <n>     — Alterna projeto (numero ou nome)
  /run            — Executa comando da whitelist
  /clear          — Limpa a sessao atual
  /status         — Info da sessao ativa
  /plugins        — Lista plugins carregados
  /notifications  — Liga/desliga notificacoes (on/off)
  /mute           — Silencia notificacoes por N minutos`;

    if (pluginRegistry) {
      const pluginCommands = pluginRegistry.listCommands();
      if (pluginCommands.length > 0) {
        text += '\n\nComandos de plugins:';
        for (const cmd of pluginCommands) {
          text += `\n  /${cmd.command} — ${cmd.description} (${cmd.plugin})`;
        }
      }
    }

    text += '\n\nEnvie qualquer mensagem de texto para conversar com o projeto ativo.';

    await sendWithMarkdown(ctx, text);
  };
}

// Backwards-compatible export for simple usage
export async function handleHelp(ctx: Context): Promise<void> {
  return createHelpHandler()(ctx);
}
