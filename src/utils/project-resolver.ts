import type { ProjectConfig } from '../types.js';

export function resolveProjectByNameOrIndex(
  input: string,
  projects: Record<string, ProjectConfig>
): { name: string; project: ProjectConfig } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const num = Number(trimmed);
  if (Number.isInteger(num) && num >= 1) {
    const entries = Object.entries(projects);
    if (num > entries.length) return null;
    const [name, project] = entries[num - 1];
    return { name, project };
  }

  const project = projects[trimmed];
  if (!project) return null;
  return { name: trimmed, project };
}

export function shortenPath(fullPath: string): string {
  const parts = fullPath.split('/');
  return parts.slice(-2).join('/');
}
