import { describe, it, expect, vi } from 'vitest';
import { createCommandContext } from '../../../src/plugins/context.js';
import { createMockContext } from '../../helpers/mock-telegram.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const proc = {
      stdin: { end: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    };
    // Simulate close event
    proc.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 10);
      }
      return proc;
    });
    proc.stdout.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'data') {
        setTimeout(() => cb(Buffer.from('output')), 5);
      }
      return proc;
    });
    proc.stderr.on.mockImplementation((_event: string, _cb: Function) => proc);
    return proc;
  }),
}));

describe('createCommandContext', () => {
  const project = { name: 'test', path: '/tmp/test', adapter: 'claude' as const };
  const chatId = '12345';

  it('creates context with correct properties', () => {
    const ctx = createMockContext();
    const cmdCtx = createCommandContext(ctx as any, ['arg1'], 'arg1', project, chatId);
    expect(cmdCtx.args).toEqual(['arg1']);
    expect(cmdCtx.rawArgs).toBe('arg1');
    expect(cmdCtx.project).toBe(project);
    expect(cmdCtx.chatId).toBe(chatId);
  });

  it('reply sends message via context', async () => {
    const ctx = createMockContext();
    const cmdCtx = createCommandContext(ctx as any, [], '', project, chatId);
    await cmdCtx.reply('hello');
    expect(ctx.reply).toHaveBeenCalled();
  });

  it('withTyping calls function and returns result', async () => {
    const ctx = createMockContext();
    const cmdCtx = createCommandContext(ctx as any, [], '', project, chatId);
    const result = await cmdCtx.withTyping(async () => 42);
    expect(result).toBe(42);
  });

  it('exec runs command and returns result', async () => {
    const ctx = createMockContext();
    const cmdCtx = createCommandContext(ctx as any, [], '', project, chatId);
    const result = await cmdCtx.exec('echo', ['test']);
    expect(result).toHaveProperty('exitCode');
    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('durationMs');
    expect(result.timedOut).toBe(false);
  });
});
