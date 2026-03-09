import type { DevBridgePlugin, PluginContext, CommandContext } from '../../../src/plugins/types.js';

async function handlePRList(ctx: CommandContext) {
  const result = await ctx.withTyping(() =>
    ctx.exec('gh', ['pr', 'list', '--limit', '10'])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr || 'gh CLI nao encontrada ou nao autenticada'}`);
    return;
  }

  const output = result.stdout || 'Nenhum PR aberto';
  await ctx.reply(`📋 Pull Requests abertos (${ctx.project.name})\n${output}`);
}

async function handlePRView(ctx: CommandContext, args: string[]) {
  const number = args[0];
  if (!number) {
    await ctx.reply('Uso: /pr view <numero>');
    return;
  }

  const result = await ctx.withTyping(() =>
    ctx.exec('gh', ['pr', 'view', number])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr}`);
    return;
  }

  await ctx.reply(`📝 PR #${number}\n${result.stdout}`);
}

async function handleIssueList(ctx: CommandContext) {
  const result = await ctx.withTyping(() =>
    ctx.exec('gh', ['issue', 'list', '--limit', '10'])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr || 'gh CLI nao encontrada ou nao autenticada'}`);
    return;
  }

  const output = result.stdout || 'Nenhuma issue aberta';
  await ctx.reply(`📝 Issues abertas (${ctx.project.name})\n${output}`);
}

async function handleIssueView(ctx: CommandContext, args: string[]) {
  const number = args[0];
  if (!number) {
    await ctx.reply('Uso: /issue view <numero>');
    return;
  }

  const result = await ctx.withTyping(() =>
    ctx.exec('gh', ['issue', 'view', number])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr}`);
    return;
  }

  await ctx.reply(`📝 Issue #${number}\n${result.stdout}`);
}

const plugin: DevBridgePlugin = {
  name: '@devbridge/plugin-github',
  version: '0.4.0',
  description: 'Integração com GitHub (PRs e Issues via gh CLI)',
  commands: [
    {
      name: 'pr',
      description: 'Pull Requests (list, view)',
      subcommands: ['list', 'view'],
      async handler(ctx: CommandContext) {
        const [sub, ...rest] = ctx.args;
        switch (sub) {
          case 'list': return handlePRList(ctx);
          case 'view': return handlePRView(ctx, rest);
          default:
            await ctx.reply('Uso: /pr <list|view>');
        }
      },
    },
    {
      name: 'issue',
      description: 'Issues (list, view)',
      subcommands: ['list', 'view'],
      async handler(ctx: CommandContext) {
        const [sub, ...rest] = ctx.args;
        switch (sub) {
          case 'list': return handleIssueList(ctx);
          case 'view': return handleIssueView(ctx, rest);
          default:
            await ctx.reply('Uso: /issue <list|view>');
        }
      },
    },
  ],
  async onLoad(context: PluginContext) {
    // Check if gh CLI is available
    context.logger.info('Plugin GitHub carregado');
  },
  async onUnload() {},
};

export default plugin;
