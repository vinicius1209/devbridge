import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationServer } from '../../../src/notifications/server.js';
import type { NotificationConfig } from '../../../src/notifications/types.js';
import { createMockNotificationConfig } from '../../helpers/test-utils.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Reset route module singleton state between tests
vi.mock('../../../src/notifications/routes.js', () => ({
  handleRoutes: vi.fn().mockResolvedValue(undefined),
  getNotificationFilter: vi.fn(),
}));

describe('NotificationServer', () => {
  let server: NotificationServer;
  let sendMessage: ReturnType<typeof vi.fn>;
  let notifConfig: NotificationConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    notifConfig = createMockNotificationConfig();
    sendMessage = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (server) {
      try { await server.stop(); } catch { /* ignore */ }
    }
  });

  it('should create a server instance', () => {
    server = new NotificationServer(0, notifConfig, sendMessage, ['12345']);
    expect(server).toBeDefined();
  });

  it('should start and stop on a random port', async () => {
    const config = { ...notifConfig, bind: '127.0.0.1' };
    server = new NotificationServer(0, config, sendMessage, ['12345']);

    await server.start();
    await server.stop();
  });

  it('should handle start on specific port', async () => {
    // Use port 0 for OS-assigned port to avoid conflicts
    const config = { ...notifConfig, bind: '127.0.0.1' };
    server = new NotificationServer(0, config, sendMessage, ['12345']);

    await expect(server.start()).resolves.toBeUndefined();
    await server.stop();
  });
});
