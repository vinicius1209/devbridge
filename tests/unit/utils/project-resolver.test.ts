import { describe, it, expect } from 'vitest';
import { resolveProjectByNameOrIndex, shortenPath } from '../../../src/utils/project-resolver.js';
import type { ProjectConfig } from '../../../src/types.js';

const projects: Record<string, ProjectConfig> = {
  backend: { path: '/home/user/projetos/meu-ingresso/backend', adapter: 'claude' },
  'portal-admin': { path: '/home/user/projetos/tixfy/portal-admin', adapter: 'claude' },
  'sowhub-core': { path: '/home/user/projetos/prime/sowhub-core', adapter: 'gemini' },
};

describe('resolveProjectByNameOrIndex', () => {
  it('resolves by name', () => {
    const result = resolveProjectByNameOrIndex('backend', projects);
    expect(result).toEqual({ name: 'backend', project: projects.backend });
  });

  it('resolves by number (1-based)', () => {
    const result = resolveProjectByNameOrIndex('1', projects);
    expect(result).toEqual({ name: 'backend', project: projects.backend });
  });

  it('resolves second entry by number', () => {
    const result = resolveProjectByNameOrIndex('2', projects);
    expect(result).toEqual({ name: 'portal-admin', project: projects['portal-admin'] });
  });

  it('resolves third entry by number', () => {
    const result = resolveProjectByNameOrIndex('3', projects);
    expect(result).toEqual({ name: 'sowhub-core', project: projects['sowhub-core'] });
  });

  it('returns null for out-of-range number', () => {
    expect(resolveProjectByNameOrIndex('99', projects)).toBeNull();
  });

  it('returns null for zero', () => {
    expect(resolveProjectByNameOrIndex('0', projects)).toBeNull();
  });

  it('returns null for negative number', () => {
    expect(resolveProjectByNameOrIndex('-1', projects)).toBeNull();
  });

  it('returns null for unknown name', () => {
    expect(resolveProjectByNameOrIndex('nonexistent', projects)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveProjectByNameOrIndex('', projects)).toBeNull();
  });

  it('returns null for whitespace', () => {
    expect(resolveProjectByNameOrIndex('   ', projects)).toBeNull();
  });

  it('trims input', () => {
    const result = resolveProjectByNameOrIndex('  backend  ', projects);
    expect(result).toEqual({ name: 'backend', project: projects.backend });
  });

  it('treats decimal as string name lookup', () => {
    expect(resolveProjectByNameOrIndex('1.5', projects)).toBeNull();
  });
});

describe('shortenPath', () => {
  it('returns last 2 segments', () => {
    expect(shortenPath('/home/user/projetos/meu-ingresso/backend')).toBe('meu-ingresso/backend');
  });

  it('handles short paths', () => {
    expect(shortenPath('/tmp/project')).toBe('tmp/project');
  });
});
