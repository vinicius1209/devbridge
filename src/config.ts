import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DevBridgeConfig } from './types.js';

const CONFIG_FILENAME = 'devbridge.config.json';

export function loadConfig(): DevBridgeConfig {
  const configPath = resolve(process.cwd(), CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.error(`Copy devbridge.config.example.json to ${CONFIG_FILENAME} and fill in your values.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Validate required fields
  if (!raw.telegram?.bot_token) {
    console.error('Config error: telegram.bot_token is required');
    process.exit(1);
  }

  if (!raw.telegram?.allowed_users?.length) {
    console.error('Config error: telegram.allowed_users must have at least one chat ID');
    process.exit(1);
  }

  if (!raw.project?.name) {
    console.error('Config error: project.name is required');
    process.exit(1);
  }

  if (!raw.project?.path) {
    console.error('Config error: project.path is required');
    process.exit(1);
  }

  if (!existsSync(raw.project.path)) {
    console.error(`Config error: project.path does not exist: ${raw.project.path}`);
    process.exit(1);
  }

  const config: DevBridgeConfig = {
    telegram: {
      bot_token: raw.telegram.bot_token,
      allowed_users: raw.telegram.allowed_users.map(String),
    },
    project: {
      name: raw.project.name,
      path: resolve(raw.project.path),
      adapter: 'claude',
      model: raw.project.model,
    },
    defaults: {
      timeout: raw.defaults?.timeout ?? 120,
      max_message_length: raw.defaults?.max_message_length ?? 4096,
      session_ttl_hours: raw.defaults?.session_ttl_hours ?? 24,
    },
  };

  return config;
}
