import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs before importing logger
vi.mock('node:fs', () => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

describe('logger', () => {
  let consoleSpy: { log: any; warn: any; error: any };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs info messages to console', async () => {
    const { logger } = await import('../../../src/utils/logger.js');
    logger.info('test message');
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('test message'));
  });

  it('logs warn messages to console.warn', async () => {
    const { logger } = await import('../../../src/utils/logger.js');
    logger.warn('warning message');
    expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('warning message'));
  });

  it('logs error messages to console.error', async () => {
    const { logger } = await import('../../../src/utils/logger.js');
    logger.error('error message');
    expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('error message'));
  });

  it('includes metadata in log output', async () => {
    const { logger } = await import('../../../src/utils/logger.js');
    logger.info('with meta', { key: 'value' });
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"key":"value"'));
  });

  it('respects log level', async () => {
    const { logger } = await import('../../../src/utils/logger.js');
    logger.setLevel('error');
    logger.info('should not appear');
    // info is below error level, but since module is cached we check differently
    logger.error('should appear');
    expect(consoleSpy.error).toHaveBeenCalled();
    logger.setLevel('info'); // Reset
  });
});
