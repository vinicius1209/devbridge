import type { NotificationConfig } from './types.js';

export class NotificationFilter {
  private config: NotificationConfig;
  private mutedUntil: Date | null = null;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  shouldNotify(eventType: string, payload: unknown): boolean {
    if (this.isMuted()) return false;
    if (!this.config.enabled) return false;

    // Check if event type is in configured events
    const p = payload as Record<string, unknown>;
    const action = p.action as string | undefined;
    const fullEvent = action ? `${eventType}.${action}` : eventType;

    // Check both full event and base event
    const configured = this.config.github_events;
    if (!configured.includes(eventType) && !configured.includes(fullEvent)) {
      return false;
    }

    // For push events, check watched branches
    if (eventType === 'push') {
      const ref = (p.ref as string)?.replace('refs/heads/', '') ?? '';
      if (!this.config.watched_branches.includes(ref)) {
        return false;
      }
    }

    return true;
  }

  mute(minutes: number): void {
    this.mutedUntil = new Date(Date.now() + minutes * 60 * 1000);
  }

  unmute(): void {
    this.mutedUntil = null;
  }

  isMuted(): boolean {
    if (!this.mutedUntil) return false;
    if (Date.now() > this.mutedUntil.getTime()) {
      this.mutedUntil = null;
      return false;
    }
    return true;
  }
}
