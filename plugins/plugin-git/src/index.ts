import type { DevBridgePlugin, PluginContext, CommandContext } from '../../../src/plugins/types.js';

async function handleStatus(ctx: CommandContext) {
  const result = await ctx.withTyping(() =>
    ctx.exec('git', ['status', '--short'])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr}`);
    return;
  }

  const branch = await ctx.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = result.stdout || 'Nenhuma alteracao';

  const lines = status.split('\n').filter(Boolean);
  const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
  const untracked = lines.filter(l => l.startsWith('??')).length;

  let summary = '';
  if (modified > 0) summary += `${modified} modificado(s)`;
  if (untracked > 0) summary += `${summary ? ', ' : ''}${untracked} nao rastreado(s)`;
  if (!summary) summary = 'Limpo';

  await ctx.reply(`📦 ${ctx.project.name} (${branch.stdout.trim()})\n${status}\n\n${summary}`);
}

async function handleLog(ctx: CommandContext, args: string[]) {
  const count = args[0] ? parseInt(args[0], 10) : 10;
  const n = isNaN(count) ? 10 : Math.min(count, 50);

  const result = await ctx.withTyping(() =>
    ctx.exec('git', ['log', '--oneline', `-${n}`])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr}`);
    return;
  }

  await ctx.reply(`📜 Ultimos ${n} commits (${ctx.project.name})\n${result.stdout}`);
}

async function handleDiff(ctx: CommandContext, args: string[]) {
  const full = args.includes('--full');
  const gitArgs = full ? ['diff'] : ['diff', '--stat'];

  const result = await ctx.withTyping(() => ctx.exec('git', gitArgs));

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr}`);
    return;
  }

  const output = result.stdout || 'Nenhuma alteracao';
  await ctx.reply(output);
}

async function handleBranch(ctx: CommandContext, args: string[]) {
  if (args[0] === 'current') {
    const result = await ctx.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    await ctx.reply(`Branch atual: ${result.stdout.trim()}`);
    return;
  }

  const result = await ctx.withTyping(() =>
    ctx.exec('git', ['branch', '-a', '--sort=-committerdate'])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Erro: ${result.stderr}`);
    return;
  }

  await ctx.reply(`🌿 Branches (${ctx.project.name})\n${result.stdout}`);
}

const plugin: DevBridgePlugin = {
  name: '@devbridge/plugin-git',
  version: '0.4.0',
  description: 'Operacoes Git basicas',
  commands: [
    {
      name: 'git',
      description: 'Operacoes Git (status, log, diff, branch)',
      subcommands: ['status', 'log', 'diff', 'branch'],
      async handler(ctx: CommandContext) {
        const [sub, ...rest] = ctx.args;
        switch (sub) {
          case 'status': return handleStatus(ctx);
          case 'log': return handleLog(ctx, rest);
          case 'diff': return handleDiff(ctx, rest);
          case 'branch': return handleBranch(ctx, rest);
          default:
            await ctx.reply('Uso: /git <status|log|diff|branch>');
        }
      },
    },
  ],
  async onLoad(context: PluginContext) {
    context.logger.info('Plugin Git carregado');
  },
  async onUnload() {},
};

export default plugin;
