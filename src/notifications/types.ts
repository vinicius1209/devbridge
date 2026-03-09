export interface NotificationConfig {
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
}

export interface GenericNotification {
  title: string;
  message: string;
  level?: 'info' | 'success' | 'warning' | 'error';
  project?: string;
}

export interface CINotification {
  status: 'success' | 'failure';
  pipeline: string;
  project?: string;
  url?: string;
  duration?: string;
}
