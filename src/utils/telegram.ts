import type { Context } from 'grammy';
import { logger } from './logger.js';

const DEFAULT_MAX_LENGTH = 4096;

/**
 * Splits a message into chunks respecting Telegram's character limit.
 * Tries to split at code block boundaries, then newlines, then at max length.
 */
export function splitMessage(text: string, maxLength = DEFAULT_MAX_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitAt = maxLength;

    // Try to split at a code block boundary (```)
    const codeBlockEnd = remaining.lastIndexOf('\n```', maxLength);
    if (codeBlockEnd > maxLength * 0.3) {
      // Find the end of the ``` line
      const lineEnd = remaining.indexOf('\n', codeBlockEnd + 1);
      splitAt = lineEnd !== -1 ? lineEnd + 1 : codeBlockEnd;
    } else {
      // Try to split at a newline
      const newlinePos = remaining.lastIndexOf('\n', maxLength);
      if (newlinePos > maxLength * 0.3) {
        splitAt = newlinePos + 1;
      }
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}

/**
 * Sends a message with MarkdownV2 formatting, falling back to plain text.
 */
export async function sendWithMarkdown(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch {
    logger.warn('Markdown parsing failed, sending as plain text');
    try {
      await ctx.reply(text);
    } catch (err) {
      logger.error('Failed to send message', { error: (err as Error).message });
    }
  }
}

/**
 * Shows typing indicator while an async function executes.
 * Re-sends typing action every 4 seconds.
 */
export async function withTypingIndicator<T>(
  ctx: Context,
  fn: () => Promise<T>
): Promise<T> {
  let typing = true;

  const sendTyping = async () => {
    while (typing) {
      try {
        await ctx.replyWithChatAction('typing');
      } catch {
        // Ignore typing indicator errors
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  };

  // Start typing in background
  const typingPromise = sendTyping();

  try {
    const result = await fn();
    return result;
  } finally {
    typing = false;
    await typingPromise.catch(() => {});
  }
}
