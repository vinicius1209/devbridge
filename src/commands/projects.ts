import type { Context } from 'grammy';
import type { DevBridgeConfig } from '../types.js';
import type { StateManager } from '../state.js';
import type { AdapterRegistry } from '../adapters/index.js';
import { sendWithMarkdown } from '../utils/telegram.js';

export function createProjectsHandler(config: DevBridgeConfig, stateManager: StateManager) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const activeProject = stateManager.getActiveProject(chatId);
    const entries = Object.entries(config.projects);

    if (entries.length === 0) {
      await ctx.reply('Nenhum projeto configurado.');
      return;
    }

    let text = 'Projetos configurados:\n';
    entries.forEach(([name, proj], i) => {
      const isActive = name === activeProject;
      const desc = proj.description ? ` — ${proj.description}` : '';
      const marker = isActive ? ' ✅ ativo' : '';
      text += `  ${i + 1}. ${name} (${proj.path}) — ${proj.adapter}${marker}${desc}\n`;
    });
    text += '\nUse /project <nome> para trocar.';

    await sendWithMarkdown(ctx, text);
  };
}

export function createProjectHandler(
  config: DevBridgeConfig,
  stateManager: StateManager,
  registry: AdapterRegistry
) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const name = ctx.match?.toString().trim();

    if (!name) {
      await ctx.reply('Uso: /project <nome>');
      return;
    }

    const project = config.projects[name];
    if (!project) {
      const available = Object.keys(config.projects).join(', ');
      await ctx.reply(`Projeto "${name}" nao encontrado. Disponiveis: ${available}`);
      return;
    }

    // Verify adapter is available
    try {
      const adapter = registry.get(project.adapter);
      const available = await adapter.isAvailable();
      if (!available) {
        await ctx.reply(`${project.adapter} CLI nao encontrada. Instale antes de usar este projeto.`);
        return;
      }
    } catch {
      await ctx.reply(`Adapter ${project.adapter} nao disponivel.`);
      return;
    }

    stateManager.setActiveProject(chatId, name);
    await ctx.reply(`Projeto ativo: ${name} (${project.adapter})`);
  };
}
