export interface DevBridgeConfig {
  telegram: {
    bot_token: string;
    allowed_users: string[];
  };
  project: {
    name: string;
    path: string;
    adapter: 'claude';
    model?: string;
  };
  defaults: {
    timeout: number;
    max_message_length: number;
    session_ttl_hours: number;
  };
}

export interface ChatOptions {
  model?: string;
  timeout?: number;
}

export interface CLIAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  chat(message: string, sessionId: string, options: ChatOptions): Promise<string>;
  newSession(projectPath: string): string;
  clearSession(sessionId: string): void;
}

export interface Session {
  id: string;
  projectName: string;
  projectPath: string;
  adapter: 'claude';
  cliSessionId: string;
  messageCount: number;
  createdAt: string;
  lastMessageAt: string;
}
