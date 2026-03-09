import type { Context, NextFunction } from 'grammy';
import { logger } from '../utils/logger.js';

export function createAuthMiddleware(allowedUsers: string[]) {
  return async (ctx: Context, next: NextFunction) => {
    const chatId = ctx.chat?.id?.toString();

    if (!chatId || !allowedUsers.includes(chatId)) {
      logger.warn('Unauthorized access attempt', { chatId: chatId ?? 'unknown' });
      return; // Silently ignore
    }

    await next();
  };
}
