<![CDATA[# Plugin Development Guide

This guide walks you through creating a DevBridge plugin from scratch. Plugins let you add new Telegram `/commands` to the bot and hook into its lifecycle.

## Overview

A DevBridge plugin is a TypeScript module that exports a `DevBridgePlugin` object as its default export. Plugins can:

- Register one or more Telegram commands
- Execute shell commands in the active project's directory
- Send formatted messages to the user
- Access bot configuration and project info
- Show typing indicators during long operations

## Plugin Interface

```typescript
interface DevBridgePlugin {
  name: string;           // Unique plugin name (e.g., "@devbridge/plugin-git")
  version: string;        // Semver version (e.g., "1.0.0")
  description: string;    // Short description shown in /plugins
  commands: PluginCommand[];  // Commands this plugin registers
  onLoad(context: PluginContext): Promise<void>;   // Called when plugin is loaded
  onUnload(): Promise<void>;                        // Called on shutdown
}
```

## Step-by-Step Tutorial

### 1. Create the Plugin Directory

```bash
mkdir my-plugin
cd my-plugin
```

### 2. Initialize package.json

```bash
cat > package.json << 'EOF'
{
  "name": "devbridge-plugin-hello",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
EOF
```

### 3. Create tsconfig.json

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
EOF
```

### 4. Write the Plugin

Create `src/index.ts`:

```typescript
import type {
  DevBridgePlugin,
  PluginContext,
  CommandContext,
} from 'devbridge/src/plugins/types.js';

// Command handler: /hello
async function handleHello(ctx: CommandContext) {
  const name = ctx.args[0] || 'World';
  await ctx.reply(`Hello, ${name}! You are working on ${ctx.project.name}.`);
}

// Command handler: /count
async function handleCount(ctx: CommandContext) {
  // Execute a shell command in the project directory
  const result = await ctx.withTyping(() =>
    ctx.exec('find', ['.', '-name', '*.ts', '-not', '-path', './node_modules/*'])
  );

  if (result.exitCode !== 0) {
    await ctx.reply(`Error: ${result.stderr}`);
    return;
  }

  const files = result.stdout.split('\n').filter(Boolean);
  await ctx.reply(`Found ${files.length} TypeScript files in ${ctx.project.name}.`);
}

const plugin: DevBridgePlugin = {
  name: 'devbridge-plugin-hello',
  version: '1.0.0',
  description: 'Example plugin with hello and count commands',

  commands: [
    {
      name: 'hello',
      description: 'Say hello (usage: /hello [name])',
      handler: handleHello,
    },
    {
      name: 'count',
      description: 'Count TypeScript files in the project',
      handler: handleCount,
    },
  ],

  async onLoad(context: PluginContext) {
    context.logger.info('Hello plugin loaded!');

    // Access plugin-specific config
    const greeting = context.pluginConfig.greeting as string | undefined;
    if (greeting) {
      context.logger.info(`Custom greeting configured: ${greeting}`);
    }
  },

  async onUnload() {
    // Clean up resources (close connections, etc.)
  },
};

export default plugin;
```

### 5. Build

```bash
yarn install
yarn build
```

### 6. Register in DevBridge Config

Add the plugin to your `devbridge.config.json`:

```json
{
  "plugins": {
    "/absolute/path/to/my-plugin": {
      "greeting": "Hey there"
    }
  }
}
```

Or if published to npm:

```json
{
  "plugins": {
    "devbridge-plugin-hello": true
  }
}
```

### 7. Test

Restart DevBridge and send `/hello` or `/count` in Telegram.

---

## API Reference

### `CommandContext`

Provided to every command handler. Contains tools for interacting with the user and the project.

```typescript
interface CommandContext {
  args: string[];           // Command arguments (split by whitespace)
  rawArgs: string;          // Raw argument string (unparsed)
  project: ProjectConfig & { name: string };  // Active project info
  chatId: string;           // Telegram chat ID of the caller

  reply(text: string): Promise<void>;
  // Send a message to the user. Long messages are automatically split.
  // Markdown formatting is attempted with plain-text fallback.

  withTyping<T>(fn: () => Promise<T>): Promise<T>;
  // Show a typing indicator while the async function executes.
  // The indicator refreshes every 4 seconds.

  exec(command: string, args?: string[]): Promise<CommandResult>;
  // Execute a shell command in the project's directory.
  // Returns stdout, stderr, exitCode, timedOut, and durationMs.
}
```

### `PluginContext`

Provided to `onLoad()`. Contains bot-wide utilities.

```typescript
interface PluginContext {
  config: DevBridgeConfig;          // Full bot configuration
  pluginConfig: Record<string, unknown>;  // Plugin-specific config from config file
  logger: {
    info(msg: string, meta?: unknown): void;
    warn(msg: string, meta?: unknown): void;
    error(msg: string, meta?: unknown): void;
    debug(msg: string, meta?: unknown): void;
  };
  sendMessage(chatId: string, text: string): Promise<void>;
  // Send a message to a specific chat ID (useful for proactive notifications)

  getActiveProject(chatId: string): (ProjectConfig & { name: string }) | null;
  // Get the active project for a given chat ID

  getProjects(): Record<string, ProjectConfig>;
  // Get all configured projects
}
```

### `PluginCommand`

Defines a command that the plugin registers.

```typescript
interface PluginCommand {
  name: string;             // Command name (without the "/" prefix)
  description: string;      // Short description shown in /help
  subcommands?: string[];   // Optional list of subcommands for documentation
  handler(ctx: CommandContext): Promise<void>;  // The command handler
}
```

### `CommandResult`

Returned by `ctx.exec()`.

```typescript
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}
```

---

## Plugin Loading

DevBridge resolves plugins in this order:

1. **Built-in plugins**: Checks `plugins/<name>/dist/index.js` relative to the DevBridge installation. The `@devbridge/plugin-` prefix is stripped for directory lookup.

2. **Local paths**: If the plugin name starts with `/`, it is treated as an absolute path. DevBridge loads `<path>/dist/index.js`.

3. **npm packages**: Falls back to a dynamic `import(name)` which resolves from `node_modules/`.

### Plugin Sources

Each loaded plugin is tagged with a source for display in `/plugins`:

| Source | Condition | Example |
|--------|-----------|---------|
| `builtin` | Name does not start with `/` or `@` | (not typical) |
| `npm` | Name starts with `@` | `@devbridge/plugin-git` |
| `local` | Name starts with `/` | `/home/user/my-plugin` |

### Error Isolation

Plugin loading errors are caught and logged. A failing plugin does **not** prevent other plugins or the bot itself from starting. This ensures that a broken plugin never takes down the entire system.

### Command Conflicts

If two plugins try to register the same command name, the first plugin wins and a warning is logged. Design your command names to be specific and unlikely to conflict.

---

## Built-in Plugins

### `@devbridge/plugin-git`

Registers: `/git`

| Subcommand | Description |
|------------|-------------|
| `/git status` | Working directory status with modified/untracked summary |
| `/git log [N]` | Last N commits (default: 10, max: 50) |
| `/git diff [--full]` | Diff stats, or full diff with `--full` |
| `/git branch` | All branches sorted by last commit |
| `/git branch current` | Current branch name |

### `@devbridge/plugin-github`

Registers: `/pr`, `/issue`

Requires the [GitHub CLI (`gh`)](https://cli.github.com/) to be installed and authenticated.

| Subcommand | Description |
|------------|-------------|
| `/pr list` | 10 most recent open pull requests |
| `/pr view <number>` | Details of a specific PR |
| `/issue list` | 10 most recent open issues |
| `/issue view <number>` | Details of a specific issue |

---

## Best Practices

1. **Keep handlers focused** -- Each command handler should do one thing. Use subcommands for related operations.

2. **Always handle errors** -- Check `exitCode` after `ctx.exec()` and report meaningful error messages with `ctx.reply()`.

3. **Use `withTyping()`** -- Wrap any operation that takes more than a second in `ctx.withTyping()` so the user sees a typing indicator.

4. **Respect output limits** -- Trim long output before calling `ctx.reply()`. While DevBridge splits messages automatically, very large outputs can be noisy.

5. **Log, don't crash** -- Use `context.logger` in `onLoad()` for diagnostics. Never throw errors that would crash the bot.

6. **Document your commands** -- Set clear `description` strings; they are shown in `/help` and `/plugins`.

7. **Namespace your commands** -- Use your plugin's domain as a command name prefix to avoid conflicts (e.g., `/myservice status` instead of just `/status`).
]]>