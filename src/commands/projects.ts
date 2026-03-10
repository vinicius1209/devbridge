import type { Context } from 'grammy';
import type { DevBridgeConfig } from '../types.js';
import type { StateManager } from '../state.js';
import type { AdapterRegistry } from '../adapters/index.js';
import { sendWithMarkdown } from '../utils/telegram.js';
import { resolveProjectByNameOrIndex, shortenPath } from '../utils/project-resolver.js';

export function createProjectsHandler(config: DevBridgeConfig, stateManager: StateManager) {
  return async (ctx: Context) => {
    const chatId = ctx.chat?.id?.toString() ?? '';
    const activeProject = stateManager.getActiveProject(chatId);
    const entries = Object.entries(config.projects);

    if (entries.length === 0) {
      await ctx.reply('Nenhum projeto configurado.');
      return;
    }

    const maxNameLen = Math.max(...entries.map(([name]) => name.length));

    let text = 'Projetos configurados:\n\n';
    entries.forEach(([name, proj], i) => {
      const isActive = name === activeProject;
      const marker = isActive ? ' ✅' : '';
      const paddedName = name.padEnd(maxNameLen);
      const shortPath = shortenPath(proj.path);
      text += `  ${i + 1}. ${paddedName} — ${proj.adapter} — ${shortPath}${marker}\n`;
    });
    text += '\n/project <numero ou nome>';

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
    const input = ctx.match?.toString().trim();

    if (!input) {
      await ctx.reply('Uso: /project <numero ou nome>');
      return;
    }

    const resolved = resolveProjectByNameOrIndex(input, config.projects);
    if (!resolved) {
      const entries = Object.entries(config.projects);
      const list = entries.map(([n], i) => `${i + 1}. ${n}`).join('\n');
      await ctx.reply(`Projeto "${input}" nao encontrado.\n\n${list}`);
      return;
    }

    const { name, project } = resolved;

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
