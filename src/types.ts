export type AdapterName = 'claude' | 'gemini';
export type PermissionLevel = 'readonly' | 'read-write' | 'full';

export interface ProjectConfig {
  path: string;
  adapter: AdapterName;
  model?: string;
  description?: string;
  permission_level?: PermissionLevel;
  allowed_tools?: string;
  skip_permissions?: boolean;
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
    stream_timeout: number;
    inactivity_timeout: number;
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
  allowedTools?: string;
  skipPermissions?: boolean;
}

export interface ChatResult {
  text: string;
  sessionId: string | null;
}

export interface StreamChatOptions extends ChatOptions {
  onChunk: (chunk: string) => void | Promise<void>;
  minChunkSize?: number;
  inactivityTimeout?: number;
}

export interface CLIAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  chat(
    message: string,
    sessionId: string | null,
    options: ChatOptions & { cwd: string },
  ): Promise<ChatResult>;
  chatStream?(
    message: string,
    sessionId: string | null,
    options: StreamChatOptions & { cwd: string },
  ): Promise<ChatResult>;
}

export interface Session {
  id: string;
  projectName: string;
  projectPath: string;
  adapter: AdapterName;
  cliSessionId: string | null;
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
