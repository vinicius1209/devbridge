import { vi } from 'vitest';
import type { CLIAdapter, ChatOptions } from '../../src/types.js';

export function createMockAdapter(name = 'claude'): CLIAdapter & {
  chat: ReturnType<typeof vi.fn>;
  isAvailable: ReturnType<typeof vi.fn>;
  newSession: ReturnType<typeof vi.fn>;
  clearSession: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    isAvailable: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    chat: vi.fn<(msg: string, sid: string, opts: ChatOptions & { cwd: string }) => Promise<string>>()
      .mockResolvedValue('mock response'),
    newSession: vi.fn<(path: string) => string>().mockReturnValue('mock-session-id'),
    clearSession: vi.fn<(sid: string) => void>(),
  };
}
