import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthMiddleware } from '../../../src/security/auth.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  const allowedUsers = ['12345', '67890'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next for allowed chat IDs', async () => {
    const middleware = createAuthMiddleware(allowedUsers);
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = { chat: { id: 12345 } };

    await middleware(ctx as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('should not call next for unauthorized chat IDs', async () => {
    const middleware = createAuthMiddleware(allowedUsers);
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = { chat: { id: 99999 } };

    await middleware(ctx as any, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should not call next when chat is undefined', async () => {
    const middleware = createAuthMiddleware(allowedUsers);
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = {};

    await middleware(ctx as any, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should not call next when chat.id is undefined', async () => {
    const middleware = createAuthMiddleware(allowedUsers);
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = { chat: {} };

    await middleware(ctx as any, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should handle string comparison (chat ID is number but allowed list is strings)', async () => {
    const middleware = createAuthMiddleware(['12345']);
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = { chat: { id: 12345 } };

    await middleware(ctx as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow multiple authorized users', async () => {
    const middleware = createAuthMiddleware(allowedUsers);
    const next1 = vi.fn().mockResolvedValue(undefined);
    const next2 = vi.fn().mockResolvedValue(undefined);

    await middleware({ chat: { id: 12345 } } as any, next1);
    await middleware({ chat: { id: 67890 } } as any, next2);

    expect(next1).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
  });
});
