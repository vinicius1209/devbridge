<![CDATA[# Contributing to DevBridge

Thank you for your interest in contributing to DevBridge! This guide will help you get started.

## Prerequisites

- **Node.js 20+** (check with `node --version`)
- **Yarn** (check with `yarn --version`)
- **TypeScript 5.6+** (installed as devDependency)
- At least one AI CLI installed:
  - [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) -- `claude --version`
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) -- `gemini --version`
- A Telegram bot token (from [@BotFather](https://t.me/BotFather)) for manual testing

## Getting Started

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/devbridge.git
cd devbridge
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Create your config

```bash
cp devbridge.config.example.json devbridge.config.json
```

Edit `devbridge.config.json` with your Telegram bot token, chat ID, and at least one project.

### 4. Start in development mode

```bash
yarn dev
```

This uses `tsx watch` to auto-reload on file changes.

### 5. Build

```bash
yarn build
```

This compiles TypeScript to `dist/` using the project's `tsconfig.json`.

## Project Structure

```
devbridge/
├── bin/
│   └── cli.ts              # CLI entry point (devbridge init/start/stop/logs/status)
├── src/
│   ├── index.ts             # Main entry point (starts bot + notification server)
│   ├── bot.ts               # Bot factory (registers middleware, commands, plugins)
│   ├── config.ts            # Config loader and validator
│   ├── router.ts            # Chat message handler (routes text to AI adapter)
│   ├── state.ts             # Per-user state (active project selection)
│   ├── types.ts             # Shared TypeScript interfaces
│   ├── adapters/
│   │   ├── index.ts         # AdapterRegistry (manages CLI adapters)
│   │   ├── claude.ts        # Claude CLI adapter
│   │   └── gemini.ts        # Gemini CLI adapter
│   ├── commands/
│   │   ├── help.ts          # /help, /start
│   │   ├── projects.ts      # /projects, /project
│   │   ├── sessions.ts      # /sessions, /switch
│   │   ├── run.ts           # /run (sandboxed command execution)
│   │   ├── clear.ts         # /clear
│   │   ├── status.ts        # /status
│   │   ├── plugins.ts       # /plugins
│   │   ├── notifications.ts # /notifications
│   │   └── mute.ts          # /mute
│   ├── sessions/
│   │   ├── manager.ts       # Session lifecycle (create, update, clear, cleanup)
│   │   └── store.ts         # Disk persistence (~/.devbridge/sessions.json)
│   ├── security/
│   │   ├── auth.ts          # Telegram chat ID whitelist middleware
│   │   └── sandbox.ts       # Command whitelist and safe execution
│   ├── plugins/
│   │   ├── types.ts         # Plugin interfaces (DevBridgePlugin, PluginCommand, etc.)
│   │   ├── loader.ts        # Plugin discovery and loading (builtin/local/npm)
│   │   ├── registry.ts      # Command registration with conflict detection
│   │   └── context.ts       # CommandContext factory for plugin handlers
│   ├── notifications/
│   │   ├── types.ts         # Notification interfaces
│   │   ├── server.ts        # HTTP server for receiving webhooks
│   │   ├── routes.ts        # Route handlers (/notify, /webhook/github, /webhook/ci)
│   │   ├── filters.ts       # Event filtering and mute logic
│   │   ├── rate-limiter.ts  # Per-IP rate limiter
│   │   └── formatter.ts     # Telegram message formatters for events
│   ├── utils/
│   │   ├── logger.ts        # Console + file logger
│   │   ├── process.ts       # CLI process spawner with timeout
│   │   └── telegram.ts      # Message splitting, markdown, typing indicator
│   └── cli/
│       ├── init.ts          # Setup wizard
│       ├── service.ts       # OS service manager (launchd/systemd)
│       └── scanner.ts       # Project directory scanner
├── plugins/
│   ├── plugin-git/          # Built-in Git plugin
│   │   ├── src/index.ts
│   │   └── package.json
│   └── plugin-github/       # Built-in GitHub plugin
│       ├── src/index.ts
│       └── package.json
├── devbridge.config.example.json
├── package.json
└── tsconfig.json
```

## How to Add a New Adapter

Adapters bridge DevBridge to AI CLI tools. To add support for a new CLI:

1. Create a new file in `src/adapters/`, e.g., `src/adapters/codex.ts`
2. Implement the `CLIAdapter` interface:

```typescript
import type { CLIAdapter, ChatOptions } from '../types.js';

export class CodexAdapter implements CLIAdapter {
  name = 'codex';

  async isAvailable(): Promise<boolean> {
    // Check if the CLI binary is installed
  }

  async chat(message: string, sessionId: string, options: ChatOptions & { cwd: string }): Promise<string> {
    // Spawn the CLI process and return its output
  }

  newSession(projectPath: string): string {
    // Return a new session identifier
  }

  clearSession(sessionId: string): void {
    // Clean up session state
  }
}
```

3. Register it in `src/adapters/index.ts`:

```typescript
import { CodexAdapter } from './codex.js';

export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new ClaudeAdapter());
  registry.register(new GeminiAdapter());
  registry.register(new CodexAdapter());  // Add here
  return registry;
}
```

4. Add `'codex'` to the `AdapterName` union in `src/types.ts`.

See [docs/adapters.md](docs/adapters.md) for a detailed walkthrough.

## How to Create a Plugin

1. Create a directory for your plugin with a `package.json` and `src/index.ts`
2. Implement the `DevBridgePlugin` interface (export as default)
3. Each plugin registers commands via the `commands` array
4. Use `CommandContext` for replying, executing shell commands, and showing typing indicators

See [docs/plugins.md](docs/plugins.md) for a step-by-step tutorial with examples.

## Code Style

- **Language**: TypeScript (strict mode enabled)
- **Module System**: ESM (`"type": "module"` in package.json)
- **Target**: ES2022
- **Naming**:
  - Files: `kebab-case.ts`
  - Classes: `PascalCase`
  - Functions/variables: `camelCase`
  - Interfaces: `PascalCase` (no `I` prefix)
  - Constants: `UPPER_SNAKE_CASE` for module-level, `camelCase` for local
- **Imports**: Use `.js` extension in import paths (required for ESM resolution)
- **Error Handling**: Use `try/catch` with typed errors `(err as Error).message`
- **Logging**: Use the shared `logger` from `src/utils/logger.ts` -- never use `console.log` in library code
- **No external runtime dependencies** beyond `grammy` and `uuid` (keep the dependency tree minimal)

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following the code style above

3. **Build and verify** there are no TypeScript errors:
   ```bash
   yarn build
   ```

4. **Test manually** by running `yarn dev` and interacting with the bot via Telegram

5. **Commit** with a clear, descriptive message:
   ```
   feat: add Codex CLI adapter
   fix: handle corrupted sessions on startup
   docs: add adapter creation guide
   ```

6. **Push** and open a Pull Request against `main`

7. **Describe your changes** in the PR body:
   - What the change does
   - Why it is needed
   - How to test it

## Testing

DevBridge currently relies on manual testing through the Telegram bot. When contributing:

- Verify your change works end-to-end by chatting with the bot
- Test edge cases (invalid input, missing config, unavailable CLIs)
- If adding a new command, verify `/help` displays it correctly
- If modifying the notification server, test with `curl` against the HTTP endpoints
- Ensure `yarn build` completes without errors

## Reporting Issues

- Use [GitHub Issues](https://github.com/vinicius1209/devbridge/issues) to report bugs or request features
- Include your Node.js version, OS, and relevant config (with secrets redacted)
- Provide steps to reproduce the issue

## License

By contributing to DevBridge, you agree that your contributions will be licensed under the [MIT License](LICENSE).
]]>