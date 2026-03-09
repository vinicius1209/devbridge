import type { Context } from 'grammy';
import { sendWithMarkdown } from '../utils/telegram.js';

export async function handleHelp(ctx: Context): Promise<void> {
  const text = `*DevBridge v0.1*

Comandos disponiveis:
  /help   — Mostra esta mensagem
  /clear  — Limpa a sessao atual e comeca do zero
  /status — Mostra info da sessao ativa

Envie qualquer mensagem de texto para conversar com o projeto.`;

  await sendWithMarkdown(ctx, text);
}
