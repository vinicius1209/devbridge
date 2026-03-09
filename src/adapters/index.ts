import type { CLIAdapter } from './base.js';
import { ClaudeAdapter } from './claude.js';

const adapters: Record<string, CLIAdapter> = {
  claude: new ClaudeAdapter(),
};

export function getAdapter(name: string): CLIAdapter {
  const adapter = adapters[name];
  if (!adapter) {
    throw new Error(`Adapter '${name}' not found. Available: ${Object.keys(adapters).join(', ')}`);
  }
  return adapter;
}

export function getAllAdapters(): CLIAdapter[] {
  return Object.values(adapters);
}
