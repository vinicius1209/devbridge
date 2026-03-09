import type { CLIAdapter } from '../types.js';
import { ClaudeAdapter } from './claude.js';
import { GeminiAdapter } from './gemini.js';
import { logger } from '../utils/logger.js';

export class AdapterRegistry {
  private adapters = new Map<string, CLIAdapter>();

  register(adapter: CLIAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): CLIAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter '${name}' nao encontrado. Disponiveis: ${[...this.adapters.keys()].join(', ')}`);
    }
    return adapter;
  }

  async getAvailable(): Promise<CLIAdapter[]> {
    const available: CLIAdapter[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        if (await adapter.isAvailable()) {
          available.push(adapter);
        }
      } catch {
        logger.warn(`Adapter ${adapter.name} check failed`);
      }
    }
    return available;
  }

  getAll(): CLIAdapter[] {
    return [...this.adapters.values()];
  }
}

export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new ClaudeAdapter());
  registry.register(new GeminiAdapter());
  return registry;
}
