import { readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface DetectedProject {
  name: string;
  path: string;
  type: string;
  indicators: string[];
}

const PROJECT_INDICATORS: Record<string, string> = {
  'package.json': 'Node.js',
  'pyproject.toml': 'Python',
  'requirements.txt': 'Python',
  'go.mod': 'Go',
  'Cargo.toml': 'Rust',
  'pom.xml': 'Java',
  'build.gradle': 'Java',
  'Gemfile': 'Ruby',
  'composer.json': 'PHP',
};

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', '__pycache__', 'vendor']);

export function scanForProjects(basePath: string, maxDepth = 2): DetectedProject[] {
  const projects: DetectedProject[] = [];
  scan(basePath, 0, maxDepth, projects);
  return projects;
}

function scan(dir: string, depth: number, maxDepth: number, results: DetectedProject[]) {
  if (depth > maxDepth) return;

  try {
    const entries = readdirSync(dir);
    const indicators: string[] = [];
    let type = 'Unknown';

    for (const entry of entries) {
      if (PROJECT_INDICATORS[entry]) {
        indicators.push(entry);
        type = PROJECT_INDICATORS[entry];
      }
    }

    if (indicators.length > 0 && depth > 0) {
      results.push({
        name: basename(dir),
        path: dir,
        type,
        indicators,
      });
      return; // Don't recurse into detected projects
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue;
      const fullPath = join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          scan(fullPath, depth + 1, maxDepth, results);
        }
      } catch { /* permission errors etc */ }
    }
  } catch { /* permission errors */ }
}
