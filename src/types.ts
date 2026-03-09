export type AdapterName = 'claude' | 'gemini';

export interface ProjectConfig {
  path: string;
  adapter: AdapterName;
  model?: string;
  description?: string;
}

export interface DevBridgeConfig {
  telegram: {
    bot_token: string;
    allowed_users: string[];
  };
  // v0.1 compat
  project?: {
    name: string;
    path: string;
    adapter: AdapterName;
    model?: string;
  };
  // v0.2+
  projects: Record<string, ProjectConfig>;
  commands: Record<string, string>;
  plugins?: Record<string, boolean | Record<string, unknown>>;
  defaults: {
    adapter: AdapterName;
    model?: string;
    timeout: number;
    max_message_length: number;
    session_ttl_hours: number;
    command_timeout: number;
  };
  notifications?: {
    enabled: boolean;
    port: number;
    bind?: string;
    secret?: string;
    github_events: string[];
    watched_branches: string[];
    rate_limit: {
      max_per_minute: number;
      cooldown_seconds: number;
    };
  };
}

export interface ChatOptions {
  model?: string;
  timeout?: number;
}

export interface CLIAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  chat(message: string, sessionId: string, options: ChatOptions & { cwd: string }): Promise<string>;
  newSession(projectPath: string): string;
  clearSession(sessionId: string): void;
}

export interface Session {
  id: string;
  projectName: string;
  projectPath: string;
  adapter: AdapterName;
  cliSessionId: string;
  messageCount: number;
  createdAt: string;
  lastMessageAt: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}
