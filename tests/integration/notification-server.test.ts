import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { NotificationServer } from '../../src/notifications/server.js';
import type { NotificationConfig } from '../../src/notifications/types.js';

function makeRequest(port: number, method: string, path: string, body?: string, headers?: Record<string, string>): Promise<{
  statusCode: number;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode ?? 0, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('Notification Server Integration', () => {
  let server: NotificationServer;
  let sendMessage: ReturnType<typeof vi.fn>;
  let port: number;

  const config: NotificationConfig = {
    enabled: true,
    port: 0, // Random port
    bind: '127.0.0.1',
    github_events: ['push', 'pull_request'],
    watched_branches: ['main', 'develop'],
    rate_limit: {
      max_per_minute: 100,
      cooldown_seconds: 1,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    sendMessage = vi.fn().mockResolvedValue(undefined);
    server = new NotificationServer(0, config, sendMessage, ['12345']);
    await server.start();

    // Get the actual port assigned by the OS
    const addr = (server as any).server.address();
    port = addr.port;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should respond to health check', async () => {
    const res = await makeRequest(port, 'GET', '/health');

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.status).toBe('ok');
    expect(data.uptime).toBeDefined();
  });

  it('should reject non-POST methods on webhook endpoints', async () => {
    const res = await makeRequest(port, 'GET', '/notify');

    expect(res.statusCode).toBe(405);
  });

  it('should accept generic notification', async () => {
    const body = JSON.stringify({
      title: 'Test Alert',
      message: 'Something happened',
      level: 'info',
    });

    const res = await makeRequest(port, 'POST', '/notify', body);

    expect(res.statusCode).toBe(200);
    expect(sendMessage).toHaveBeenCalledWith('12345', expect.stringContaining('Test Alert'));
  });

  it('should reject malformed notification', async () => {
    const body = JSON.stringify({
      // Missing title and message
      level: 'info',
    });

    const res = await makeRequest(port, 'POST', '/notify', body);

    expect(res.statusCode).toBe(400);
  });

  it('should reject invalid JSON', async () => {
    const res = await makeRequest(port, 'POST', '/notify', 'not json{{{');

    expect(res.statusCode).toBe(400);
  });

  it('should return 404 for unknown routes', async () => {
    const res = await makeRequest(port, 'POST', '/unknown', '{}');

    expect(res.statusCode).toBe(404);
  });

  it('should handle GitHub webhook', async () => {
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { name: 'test-repo' },
      pusher: { name: 'dev' },
      commits: [{ id: 'abc1234567', message: 'test commit' }],
    });

    const res = await makeRequest(port, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
    });

    expect(res.statusCode).toBe(200);
    expect(sendMessage).toHaveBeenCalled();
  });

  it('should reject GitHub webhook missing event header', async () => {
    const res = await makeRequest(port, 'POST', '/webhook/github', '{}');

    expect(res.statusCode).toBe(400);
  });

  it('should handle CI webhook', async () => {
    const payload = JSON.stringify({
      status: 'success',
      pipeline: 'build',
    });

    const res = await makeRequest(port, 'POST', '/webhook/ci', payload);

    expect(res.statusCode).toBe(200);
    expect(sendMessage).toHaveBeenCalled();
  });

  it('should reject CI webhook missing required fields', async () => {
    const payload = JSON.stringify({
      status: 'success',
      // Missing pipeline
    });

    const res = await makeRequest(port, 'POST', '/webhook/ci', payload);

    expect(res.statusCode).toBe(400);
  });
});

describe('Notification Server with Secret', () => {
  let server: NotificationServer;
  let sendMessage: ReturnType<typeof vi.fn>;
  let port: number;

  const secret = 'test-webhook-secret';
  const config: NotificationConfig = {
    enabled: true,
    port: 0,
    bind: '127.0.0.1',
    secret,
    github_events: ['push'],
    watched_branches: ['main'],
    rate_limit: {
      max_per_minute: 100,
      cooldown_seconds: 1,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    sendMessage = vi.fn().mockResolvedValue(undefined);
    server = new NotificationServer(0, config, sendMessage, ['12345']);
    await server.start();

    const addr = (server as any).server.address();
    port = addr.port;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should accept webhook with valid signature', async () => {
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { name: 'test-repo' },
      pusher: { name: 'dev' },
      commits: [{ id: 'abc1234567', message: 'test' }],
    });

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const signature = `sha256=${hmac.digest('hex')}`;

    const res = await makeRequest(port, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': signature,
    });

    expect(res.statusCode).toBe(200);
  });

  it('should reject webhook with invalid signature', async () => {
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { name: 'test-repo' },
      pusher: { name: 'dev' },
      commits: [],
    });

    const res = await makeRequest(port, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': 'sha256=invalid',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject webhook without signature when secret is configured', async () => {
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      repository: { name: 'test-repo' },
      pusher: { name: 'dev' },
      commits: [],
    });

    const res = await makeRequest(port, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
    });

    expect(res.statusCode).toBe(401);
  });
});
