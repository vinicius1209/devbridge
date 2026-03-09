import http from 'node:http';
import crypto from 'node:crypto';
import type { NotificationConfig, GenericNotification, CINotification } from './types.js';
import { formatGeneric, formatGitHubEvent, formatCI } from './formatter.js';
import { RateLimiter } from './rate-limiter.js';
import { NotificationFilter } from './filters.js';
import { logger } from '../utils/logger.js';

const rateLimiter = new RateLimiter();
let filter: NotificationFilter | null = null;

function getFilter(config: NotificationConfig): NotificationFilter {
  if (!filter) filter = new NotificationFilter(config);
  return filter;
}

export function getNotificationFilter(config: NotificationConfig): NotificationFilter {
  return getFilter(config);
}

export async function handleRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: string,
  config: NotificationConfig,
  sendMessage: (chatId: string, text: string) => Promise<void>,
  allowedUsers: string[]
) {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';
  const ip = req.socket.remoteAddress ?? 'unknown';
  const nf = getFilter(config);

  // Health check
  if (method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  if (method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Rate limit
  if (!rateLimiter.isAllowed(ip, config.rate_limit.max_per_minute)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rate limited' }));
    return;
  }

  // Check if muted
  if (nf.isMuted()) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'muted' }));
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  let message: string | null = null;

  switch (url) {
    case '/notify': {
      const notif = payload as GenericNotification;
      if (!notif.title || !notif.message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'title and message required' }));
        return;
      }
      message = formatGeneric(notif);
      break;
    }

    case '/webhook/github': {
      // Verify signature if secret configured
      if (config.secret) {
        const signature = req.headers['x-hub-signature-256'] as string;
        if (!signature || !verifyGitHubSignature(body, signature, config.secret)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
      }

      const eventType = req.headers['x-github-event'] as string;
      if (!eventType) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing X-GitHub-Event header' }));
        return;
      }

      // Check if event is in filter
      if (!nf.shouldNotify(eventType, payload)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'filtered' }));
        return;
      }

      message = formatGitHubEvent(eventType, payload as Record<string, unknown>);
      break;
    }

    case '/webhook/ci': {
      const ci = payload as CINotification;
      if (!ci.status || !ci.pipeline) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'status and pipeline required' }));
        return;
      }
      message = formatCI(ci);
      break;
    }

    default:
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
  }

  if (message) {
    for (const chatId of allowedUsers) {
      try {
        await sendMessage(chatId, message);
      } catch (err) {
        logger.error('Failed to send notification', { chatId, error: (err as Error).message });
      }
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
}

function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
