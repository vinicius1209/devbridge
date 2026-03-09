import type { Context } from 'grammy';
import { sendWithMarkdown } from '../utils/telegram.js';

export async function handleHelp(ctx: Context): Promise<void> {
  const text = `*DevBridge v0.2*

Comandos disponiveis:
  /help      — Mostra esta mensagem
  /projects  — Lista projetos configurados
  /project   — Troca o projeto ativo
  /sessions  — Lista sessoes ativas
  /switch    — Alterna para sessao de outro projeto
  /run       — Executa comando da whitelist
  /clear     — Limpa a sessao atual
  /status    — Info da sessao ativa

Envie qualquer mensagem de texto para conversar com o projeto ativo.`;

  await sendWithMarkdown(ctx, text);
}
