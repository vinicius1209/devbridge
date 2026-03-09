import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DevBridgeConfig, ProjectConfig } from './types.js';
import { logger } from './utils/logger.js';

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

  // Retrocompatibility: v0.1 "project" (singular) → v0.2 "projects" (plural)
  let projects: Record<string, ProjectConfig> = {};

  if (raw.project && !raw.projects) {
    logger.warn('Config migrado automaticamente de v0.1. Atualize para o formato v0.2 com "projects".');
    projects[raw.project.name] = {
      path: resolve(raw.project.path),
      adapter: raw.project.adapter ?? 'claude',
      model: raw.project.model,
    };
  } else if (raw.projects) {
    for (const [name, proj] of Object.entries(raw.projects)) {
      const p = proj as Record<string, unknown>;
      projects[name] = {
        path: resolve(p.path as string),
        adapter: (p.adapter as 'claude' | 'gemini') ?? 'claude',
        model: p.model as string | undefined,
        description: p.description as string | undefined,
      };
    }
  } else {
    console.error('Config error: at least one project must be configured (project or projects)');
    process.exit(1);
  }

  // Validate project paths
  for (const [name, proj] of Object.entries(projects)) {
    if (!existsSync(proj.path)) {
      console.error(`Config error: project "${name}" path does not exist: ${proj.path}`);
      process.exit(1);
    }
  }

  // Parse notifications config with defaults
  const rawNotif = raw.notifications;
  const notifications = rawNotif
    ? {
        enabled: rawNotif.enabled ?? true,
        port: rawNotif.port ?? 9876,
        bind: rawNotif.bind,
        secret: rawNotif.secret,
        github_events: rawNotif.github_events ?? ['push', 'pull_request', 'issues', 'workflow_run'],
        watched_branches: rawNotif.watched_branches ?? ['main', 'master', 'develop'],
        rate_limit: {
          max_per_minute: rawNotif.rate_limit?.max_per_minute ?? 30,
          cooldown_seconds: rawNotif.rate_limit?.cooldown_seconds ?? 5,
        },
      }
    : undefined;

  const config: DevBridgeConfig = {
    telegram: {
      bot_token: raw.telegram.bot_token,
      allowed_users: raw.telegram.allowed_users.map(String),
    },
    projects,
    commands: raw.commands ?? {},
    plugins: raw.plugins ?? {},
    defaults: {
      adapter: raw.defaults?.adapter ?? 'claude',
      model: raw.defaults?.model,
      timeout: raw.defaults?.timeout ?? 120,
      max_message_length: raw.defaults?.max_message_length ?? 4096,
      session_ttl_hours: raw.defaults?.session_ttl_hours ?? 24,
      command_timeout: raw.defaults?.command_timeout ?? 60,
    },
    notifications,
  };

  return config;
}
