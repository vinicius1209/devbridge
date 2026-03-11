import { describe, it, expect } from 'vitest';
import { resolvePermissions } from '../../../src/adapters/permissions.js';

describe('resolvePermissions', () => {
  describe('Claude adapter', () => {
    it('should default to readonly', () => {
      const result = resolvePermissions('claude');
      expect(result.allowedTools).toBe('Read,Glob,Grep');
      expect(result.skipPermissions).toBe(false);
    });

    it('should resolve readonly level', () => {
      const result = resolvePermissions('claude', 'readonly');
      expect(result.allowedTools).toBe('Read,Glob,Grep');
      expect(result.skipPermissions).toBe(false);
    });

    it('should resolve read-write level', () => {
      const result = resolvePermissions('claude', 'read-write');
      expect(result.allowedTools).toContain('Write');
      expect(result.allowedTools).toContain('Edit');
      expect(result.skipPermissions).toBe(true);
    });

    it('should resolve full level', () => {
      const result = resolvePermissions('claude', 'full');
      expect(result.allowedTools).toContain('Bash');
      expect(result.allowedTools).toContain('Write');
      expect(result.allowedTools).toContain('Agent');
      expect(result.skipPermissions).toBe(true);
    });

    it('should allow allowedTools override', () => {
      const result = resolvePermissions('claude', 'readonly', 'Read,Bash');
      expect(result.allowedTools).toBe('Read,Bash');
    });

    it('should allow skipPermissions override', () => {
      const result = resolvePermissions('claude', 'readonly', undefined, true);
      expect(result.skipPermissions).toBe(true);
    });
  });

  describe('Gemini adapter', () => {
    it('should default to readonly', () => {
      const result = resolvePermissions('gemini');
      expect(result.allowedTools).toContain('ReadFileTool');
      expect(result.allowedTools).toContain('GlobTool');
      expect(result.skipPermissions).toBe(false);
    });

    it('should resolve read-write level with Gemini tool names', () => {
      const result = resolvePermissions('gemini', 'read-write');
      expect(result.allowedTools).toContain('WriteFileTool');
      expect(result.allowedTools).toContain('EditTool');
      expect(result.skipPermissions).toBe(true);
    });

    it('should resolve full level with Gemini tool names', () => {
      const result = resolvePermissions('gemini', 'full');
      expect(result.allowedTools).toContain('ShellTool');
      expect(result.allowedTools).toContain('WriteFileTool');
      expect(result.skipPermissions).toBe(true);
    });
  });

  describe('overrides take precedence', () => {
    it('should use explicit allowedTools over permission level', () => {
      const result = resolvePermissions('claude', 'full', 'Read,Glob');
      expect(result.allowedTools).toBe('Read,Glob');
      expect(result.skipPermissions).toBe(true);
    });

    it('should use explicit skipPermissions over permission level', () => {
      const result = resolvePermissions('claude', 'full', undefined, false);
      expect(result.skipPermissions).toBe(false);
    });
  });
});
