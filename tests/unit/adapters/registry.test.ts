import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdapterRegistry, createDefaultRegistry } from '../../../src/adapters/index.js';
import { createMockAdapter } from '../../helpers/mock-adapter.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the actual adapter modules to avoid spawnCLI issues
vi.mock('../../../src/adapters/claude.js', () => ({
  ClaudeAdapter: vi.fn().mockImplementation(() => ({
    name: 'claude',
    isAvailable: vi.fn().mockResolvedValue(true),
    chat: vi.fn(),
  })),
}));

vi.mock('../../../src/adapters/gemini.js', () => ({
  GeminiAdapter: vi.fn().mockImplementation(() => ({
    name: 'gemini',
    isAvailable: vi.fn().mockResolvedValue(true),
    chat: vi.fn(),
  })),
}));

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('register', () => {
    it('should register an adapter', () => {
      const adapter = createMockAdapter('claude');
      registry.register(adapter);

      const retrieved = registry.get('claude');
      expect(retrieved).toBe(adapter);
    });
  });

  describe('get', () => {
    it('should return registered adapter by name', () => {
      const adapter = createMockAdapter('claude');
      registry.register(adapter);

      expect(registry.get('claude')).toBe(adapter);
    });

    it('should throw for unregistered adapter', () => {
      expect(() => registry.get('unknown')).toThrow(/Adapter 'unknown' nao encontrado/);
    });

    it('should include available adapters in error message', () => {
      registry.register(createMockAdapter('claude'));
      registry.register(createMockAdapter('gemini'));

      expect(() => registry.get('unknown')).toThrow(/claude, gemini/);
    });
  });

  describe('getAvailable', () => {
    it('should return only available adapters', async () => {
      const claude = createMockAdapter('claude');
      claude.isAvailable.mockResolvedValue(true);

      const gemini = createMockAdapter('gemini');
      gemini.isAvailable.mockResolvedValue(false);

      registry.register(claude);
      registry.register(gemini);

      const available = await registry.getAvailable();
      expect(available).toHaveLength(1);
      expect(available[0].name).toBe('claude');
    });

    it('should return empty array if none are available', async () => {
      const claude = createMockAdapter('claude');
      claude.isAvailable.mockResolvedValue(false);
      registry.register(claude);

      const available = await registry.getAvailable();
      expect(available).toHaveLength(0);
    });

    it('should handle adapter check failures gracefully', async () => {
      const claude = createMockAdapter('claude');
      claude.isAvailable.mockRejectedValue(new Error('check failed'));
      registry.register(claude);

      const available = await registry.getAvailable();
      expect(available).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return all registered adapters', () => {
      const claude = createMockAdapter('claude');
      const gemini = createMockAdapter('gemini');

      registry.register(claude);
      registry.register(gemini);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(a => a.name)).toContain('claude');
      expect(all.map(a => a.name)).toContain('gemini');
    });

    it('should return empty array when no adapters registered', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });
});

describe('createDefaultRegistry', () => {
  it('should create registry with claude and gemini adapters', () => {
    const registry = createDefaultRegistry();

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map(a => a.name)).toContain('claude');
    expect(all.map(a => a.name)).toContain('gemini');
  });
});
