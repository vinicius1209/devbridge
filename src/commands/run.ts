import type { Context } from 'grammy';
import type { DevBridgeConfig } from '../types.js';
import type { StateManager } from '../state.js';
import { CommandSandbox } from '../security/sandbox.js';
import { sendWithMarkdown } from '../utils/telegram.js';
import { withTypingIndicator } from '../utils/telegram.js';
import { logger } from '../utils/logger.js';

export function createRunHandler(config: DevBridgeConfig, stateManager: StateManager) {
  const sandbox = new CommandSandbox(config.commands);

  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const alias = ctx.match?.toString().trim();

    if (!alias) {
      const available = sandbox.getAvailableAliases();
      if (available.length === 0) {
        await ctx.reply('Nenhum comando configurado. Adicione comandos em "commands" no config.');
        return;
      }
      await ctx.reply(`Uso: /run <alias>\n\nComandos disponiveis: ${available.join(', ')}`);
      return;
    }

    const command = sandbox.resolve(alias);
    if (!command) {
      const available = sandbox.getAvailableAliases();
      await ctx.reply(`Comando '${alias}' nao encontrado.\nDisponiveis: ${available.join(', ')}`);
      return;
    }

    // Get active project
    const activeProject = stateManager.getActiveProject(chatId);
    if (!activeProject) {
      await ctx.reply('Nenhum projeto ativo. Use /project <nome> primeiro.');
      return;
    }

    const project = config.projects[activeProject];
    if (!project) {
      await ctx.reply('Projeto ativo nao encontrado no config.');
      return;
    }

    await ctx.reply(`Executando \`${command}\`...`);

    try {
      const result = await withTypingIndicator(ctx, () =>
        sandbox.execute(alias, project.path, config.defaults.command_timeout)
      );

      const duration = (result.durationMs / 1000).toFixed(1);

      if (result.timedOut) {
        await sendWithMarkdown(ctx, `⏱ Timeout apos ${duration}s`);
        return;
      }

      if (result.exitCode === 0) {
        const output = result.stdout ? `\n\`\`\`\n${result.stdout.slice(0, 3500)}\n\`\`\`` : '';
        await sendWithMarkdown(ctx, `✅ Sucesso (${duration}s)${output}`);
      } else {
        const output = (result.stderr || result.stdout || 'No output').slice(0, 3500);
        await sendWithMarkdown(ctx, `❌ Exit code ${result.exitCode} (${duration}s)\n\`\`\`\n${output}\n\`\`\``);
      }
    } catch (err) {
      logger.error('Run command error', { error: (err as Error).message });
      await ctx.reply(`Erro: ${(err as Error).message}`);
    }
  };
}
