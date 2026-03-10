import { vi } from 'vitest';
import type { CLIAdapter, ChatOptions, ChatResult } from '../../src/types.js';

export function createMockAdapter(name = 'claude'): CLIAdapter & {
  chat: ReturnType<typeof vi.fn>;
  isAvailable: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    isAvailable: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    chat: vi.fn<(msg: string, sid: string | null, opts: ChatOptions & { cwd: string }) => Promise<ChatResult>>()
      .mockResolvedValue({ text: 'mock response', sessionId: 'mock-cli-session-id' }),
  };
}
