import http from 'node:http';
import { logger } from '../utils/logger.js';
import { handleRoutes } from './routes.js';
import type { NotificationConfig } from './types.js';

export class NotificationServer {
  private server: http.Server;

  constructor(
    private port: number,
    private config: NotificationConfig,
    private sendMessage: (chatId: string, text: string) => Promise<void>,
    private allowedUsers: string[]
  ) {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Parse body
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });

    await new Promise<void>((resolve) => req.on('end', resolve));

    try {
      await handleRoutes(req, res, body, this.config, this.sendMessage, this.allowedUsers);
    } catch (err) {
      logger.error('Request handler error', { error: (err as Error).message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  async start(): Promise<void> {
    const bindAddress = this.config.bind ?? '127.0.0.1';

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, bindAddress, () => {
        logger.info(`Notification server listening on ${bindAddress}:${this.port}`);
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Notification server stopped');
        resolve();
      });
    });
  }
}
