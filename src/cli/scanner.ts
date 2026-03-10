import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface DetectedProject {
  name: string;
  path: string;
  type: string;
  indicators: string[];
  suggestedCommands: Record<string, string>;
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

function getPackageManager(dir: string): string {
  try {
    const entries = readdirSync(dir);
    if (entries.includes('pnpm-lock.yaml')) return 'pnpm';
    if (entries.includes('yarn.lock')) return 'yarn';
    if (entries.includes('bun.lockb')) return 'bun';
  } catch { /* ignore */ }
  return 'npm run';
}

function detectCommands(dir: string, type: string, indicators: string[]): Record<string, string> {
  const commands: Record<string, string> = {};

  if (type === 'Node.js') {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
      const scripts = pkg.scripts || {};
      const pm = getPackageManager(dir);
      if (scripts.test) commands.test = `${pm} test`;
      if (scripts.lint) commands.lint = `${pm} lint`;
      if (scripts.build) commands.build = `${pm} build`;
      if (scripts.dev) commands.dev = `${pm} dev`;
    } catch { /* ignore read errors */ }
  } else if (type === 'Java') {
    if (indicators.includes('pom.xml')) {
      commands.test = 'mvn test -q';
      commands.build = 'mvn package -q';
    } else if (indicators.includes('build.gradle')) {
      commands.test = 'gradle test';
      commands.build = 'gradle build';
    }
  } else if (type === 'Python') {
    commands.test = 'pytest';
    commands.lint = 'ruff check .';
  } else if (type === 'Go') {
    commands.test = 'go test ./...';
    commands.build = 'go build ./...';
  } else if (type === 'Rust') {
    commands.test = 'cargo test';
    commands.build = 'cargo build';
  } else if (type === 'Ruby') {
    commands.test = 'bundle exec rspec';
    commands.lint = 'bundle exec rubocop';
  } else if (type === 'PHP') {
    commands.test = 'vendor/bin/phpunit';
    commands.lint = 'vendor/bin/phpstan analyse';
  }

  return commands;
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
        suggestedCommands: detectCommands(dir, type, indicators),
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
