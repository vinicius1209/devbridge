import { vi } from 'vitest';

export interface MockContext {
  chat: { id: number };
  message: { text: string };
  match: string;
  reply: ReturnType<typeof vi.fn>;
  replyWithChatAction: ReturnType<typeof vi.fn>;
}

export function createMockContext(overrides: Partial<{
  chatId: number;
  text: string;
  match: string;
}> = {}): MockContext {
  const chatId = overrides.chatId ?? 12345;
  const text = overrides.text ?? 'hello';
  const match = overrides.match ?? '';

  return {
    chat: { id: chatId },
    message: { text },
    match,
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithChatAction: vi.fn().mockResolvedValue(undefined),
  };
}
