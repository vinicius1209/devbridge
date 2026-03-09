<!-- markdownlint-disable MD033 MD041 -->
<p align="center">
  <h1 align="center">DevBridge 🌉</h1>
  <p align="center">
    <strong>Control your projects via Telegram using Claude CLI, Gemini CLI, or any AI coding agent</strong>
  </p>
  <p align="center">
    <a href="https://github.com/vinicius1209/devbridge/actions"><img src="https://img.shields.io/github/actions/workflow/status/vinicius1209/devbridge/ci.yml?branch=main&label=CI" alt="CI"></a>
    <a href="https://www.npmjs.com/package/devbridge"><img src="https://img.shields.io/npm/v/devbridge" alt="npm version"></a>
    <a href="https://github.com/vinicius1209/devbridge/blob/main/LICENSE"><img src="https://img.shields.io/github/license/vinicius1209/devbridge" alt="License: MIT"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/devbridge" alt="Node.js"></a>
  </p>
</p>
<!-- markdownlint-enable MD033 MD041 -->

---

DevBridge turns your Telegram into a powerful developer control panel. Chat with AI coding agents (Claude, Gemini) about your codebase, run whitelisted commands, manage multiple projects, receive GitHub/CI notifications -- all from your phone.

## ✨ Features

- 🤖 **AI Chat via Telegram** -- Send messages to Claude CLI or Gemini CLI and get responses right in Telegram
- 📂 **Multi-Project Support** -- Switch between multiple codebases on the fly with `/project`
- 🔒 **Security First** -- Chat ID whitelist, command sandbox with whitelist-only execution, read-only AI tools
- 🔌 **Plugin System** -- Extend functionality with built-in or custom plugins (Git, GitHub, and more)
- 🏃 **Run Commands** -- Execute pre-approved shell commands (`/run test`, `/run build`) safely
- 💬 **Session Management** -- Persistent conversation sessions per project with automatic TTL cleanup
- 🔔 **Push Notifications** -- Receive GitHub webhooks, CI results, and custom alerts via HTTP
- 🧙 **Setup Wizard** -- Interactive `devbridge init` detects your CLIs and scans for projects
- 🖥️ **OS Service Manager** -- Run as a background service on macOS (launchd) or Linux (systemd)
- 📨 **Smart Message Splitting** -- Long responses are automatically chunked respecting Telegram's limits

## 🚀 Quick Start

### 1. Install

```bash
npx devbridge init
```

The setup wizard will:
- Detect installed AI CLIs (Claude CLI, Gemini CLI)
- Ask for your Telegram bot token (get one from [@BotFather](https://t.me/BotFather))
- Ask for your Telegram Chat ID (get it from [@userinfobot](https://t.me/userinfobot))
- Scan your filesystem for projects

### 2. Start

```bash
devbridge start
```

### 3. Chat

Open your Telegram bot and start chatting! Any text message is forwarded to the AI agent working in your active project's directory.

## 📋 Configuration Reference

DevBridge is configured via `devbridge.config.json` in your working directory. Run `devbridge init` to generate it interactively, or copy from `devbridge.config.example.json`.

```jsonc
{
  // REQUIRED: Telegram bot credentials
  "telegram": {
    "bot_token": "123456:ABC-DEF...",       // From @BotFather
    "allowed_users": ["123456789"]           // Your Telegram chat ID(s)
  },

  // REQUIRED: One or more projects
  "projects": {
    "my-app": {
      "path": "/absolute/path/to/project",  // Absolute path to project root
      "adapter": "claude",                   // "claude" or "gemini"
      "model": "sonnet",                     // Optional: model override
      "description": "My main app"           // Optional: shown in /projects
    },
    "api-backend": {
      "path": "/absolute/path/to/api",
      "adapter": "gemini",
      "description": "Backend API"
    }
  },

  // OPTIONAL: Whitelisted shell commands for /run
  "commands": {
    "test": "yarn test",
    "lint": "yarn lint",
    "build": "yarn build",
    "status": "git status --short",
    "log": "git log --oneline -10"
  },

  // OPTIONAL: Plugins to load
  "plugins": {
    "@devbridge/plugin-git": true,
    "@devbridge/plugin-github": true
  },

  // OPTIONAL: Default settings
  "defaults": {
    "adapter": "claude",           // Default adapter for new projects
    "model": "sonnet",             // Default model (adapter-specific)
    "timeout": 120,                // AI response timeout in seconds
    "max_message_length": 4096,    // Telegram message chunk size
    "session_ttl_hours": 24,       // Auto-cleanup inactive sessions
    "command_timeout": 60          // /run command timeout in seconds
  },

  // OPTIONAL: Push notification server
  "notifications": {
    "enabled": true,
    "port": 9876,                  // HTTP server port
    "bind": "127.0.0.1",           // Bind address (default: 127.0.0.1)
    "secret": "your-webhook-secret", // GitHub webhook secret for HMAC verification
    "github_events": [             // GitHub event types to forward
      "push",
      "pull_request",
      "issues",
      "workflow_run"
    ],
    "watched_branches": [          // Only notify pushes to these branches
      "main",
      "master",
      "develop"
    ],
    "rate_limit": {
      "max_per_minute": 30,        // Max notifications per IP per minute
      "cooldown_seconds": 5        // Min seconds between notifications
    }
  }
}
```

See [docs/configuration.md](docs/configuration.md) for detailed documentation of every option.

## 💬 Commands Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/projects` | List all configured projects with status |
| `/project <name>` | Switch the active project |
| `/sessions` | List all active AI sessions |
| `/switch <name>` | Switch to a different project's session |
| `/status` | Show current session info (adapter, model, message count) |
| `/clear` | Clear the current session and start fresh |
| `/run <alias>` | Execute a whitelisted command (e.g., `/run test`) |
| `/plugins` | List loaded plugins and their commands |

### Notification Commands

| Command | Description |
|---------|-------------|
| `/notifications` | Show current notification status |
| `/notifications on` | Enable push notifications |
| `/notifications off` | Disable push notifications |
| `/mute <minutes>` | Temporarily silence notifications |

### Plugin Commands (built-in)

**Git Plugin** (`@devbridge/plugin-git`):

| Command | Description |
|---------|-------------|
| `/git status` | Show working directory status with summary |
| `/git log [N]` | Show last N commits (default: 10, max: 50) |
| `/git diff [--full]` | Show diff stats, or full diff with `--full` |
| `/git branch` | List all branches sorted by last commit |
| `/git branch current` | Show the current branch name |

**GitHub Plugin** (`@devbridge/plugin-github`):

| Command | Description |
|---------|-------------|
| `/pr list` | List the 10 most recent open pull requests |
| `/pr view <number>` | View details of a specific PR |
| `/issue list` | List the 10 most recent open issues |
| `/issue view <number>` | View details of a specific issue |

### Chat

Any message that is not a command is sent to the AI agent (Claude or Gemini) as a conversation prompt. The AI operates within your active project's directory and can read files using safe, read-only tools.

## 🔌 Plugin System

DevBridge supports plugins to extend its functionality. Plugins can register new Telegram `/commands` and hook into the bot lifecycle.

### Installing Plugins

Add the plugin name to the `plugins` section of your config:

```json
{
  "plugins": {
    "@devbridge/plugin-git": true,
    "@devbridge/plugin-github": true,
    "/path/to/local/plugin": true,
    "npm-package-name": { "option": "value" }
  }
}
```

Plugins are loaded from three sources (in order):
1. **Built-in** -- shipped in the `plugins/` directory (e.g., `@devbridge/plugin-git`)
2. **Local path** -- absolute path to a plugin directory
3. **npm package** -- installed via `npm install` or `yarn add`

Set a plugin to `false` to disable it without removing the config entry.

Pass a config object instead of `true` to provide plugin-specific options.

### Creating a Plugin

See [docs/plugins.md](docs/plugins.md) for a full tutorial.

A minimal plugin:

```typescript
import type { DevBridgePlugin, PluginContext, CommandContext } from 'devbridge/plugins/types';

const plugin: DevBridgePlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  commands: [
    {
      name: 'hello',
      description: 'Say hello',
      async handler(ctx: CommandContext) {
        await ctx.reply(`Hello from ${ctx.project.name}!`);
      },
    },
  ],
  async onLoad(context: PluginContext) {
    context.logger.info('My plugin loaded!');
  },
  async onUnload() {},
};

export default plugin;
```

## 🔒 Security Model

DevBridge is designed with multiple layers of security:

1. **Chat ID Whitelist** -- Only Telegram users listed in `allowed_users` can interact with the bot. Unauthorized messages are silently dropped.

2. **Command Sandbox** -- The `/run` command only executes commands explicitly listed in the `commands` config. Commands are spawned without `shell: true` to prevent injection attacks.

3. **Read-Only AI Tools** -- The Claude adapter restricts the AI to read-only tools (`Read`, `Glob`, `Grep`), preventing the AI from modifying files when accessed via Telegram.

4. **Webhook Signature Verification** -- GitHub webhooks are verified using HMAC-SHA256 signatures when a `secret` is configured.

5. **Rate Limiting** -- The notification HTTP server enforces per-IP rate limits to prevent abuse.

6. **Local Bind** -- The notification server binds to `127.0.0.1` by default, preventing external access unless explicitly configured.

See [docs/security.md](docs/security.md) for a detailed breakdown.

## 🖥️ CLI Reference

```
devbridge init     -- Interactive setup wizard
devbridge start    -- Start the bot in foreground
devbridge stop     -- Stop the background service
devbridge logs     -- Show recent logs (-f to follow)
devbridge status   -- Show service status
```

## 🔔 Push Notifications

When `notifications.enabled` is `true`, DevBridge starts an HTTP server that accepts:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (returns `{ status: "ok" }`) |
| `/notify` | POST | Send a generic notification |
| `/webhook/github` | POST | Receive GitHub webhook events |
| `/webhook/ci` | POST | Receive CI pipeline results |

### Example: Generic notification

```bash
curl -X POST http://localhost:9876/notify \
  -H "Content-Type: application/json" \
  -d '{"title": "Deploy complete", "message": "v2.1.0 deployed to production", "level": "success"}'
```

### Example: GitHub Webhook

Configure your GitHub repository webhook to point to `http://your-server:9876/webhook/github` with content type `application/json` and your shared secret.

### Example: CI notification

```bash
curl -X POST http://localhost:9876/webhook/ci \
  -H "Content-Type: application/json" \
  -d '{"status": "success", "pipeline": "build-and-test", "project": "my-app", "duration": "2m 34s"}'
```

## ❓ FAQ

**Q: Which AI CLIs are supported?**
A: Claude CLI and Gemini CLI are supported out of the box. DevBridge uses an adapter system, so new CLIs can be added by implementing the `CLIAdapter` interface. See [docs/adapters.md](docs/adapters.md).

**Q: Can the AI modify my files?**
A: By default, no. The Claude adapter restricts the AI to read-only tools (`Read`, `Glob`, `Grep`). The Gemini adapter passes messages directly with no tool restrictions from DevBridge's side (restrictions depend on Gemini CLI's own configuration).

**Q: Is it safe to expose the notification server to the internet?**
A: The server binds to `127.0.0.1` by default. If you need external access (e.g., for GitHub webhooks), use a reverse proxy with HTTPS, configure a webhook `secret` for HMAC verification, and consider firewall rules. Rate limiting is built in.

**Q: Can multiple people use the same bot?**
A: Yes. Add multiple chat IDs to `allowed_users`. Each user has independent project selection and session state.

**Q: What happens when the AI session gets corrupted?**
A: Use `/clear` to reset the session. DevBridge automatically detects corrupted sessions and clears them when errors are reported by the CLI.

**Q: How do sessions persist across restarts?**
A: Sessions are saved to `~/.devbridge/sessions.json` and restored on startup. Expired sessions (older than `session_ttl_hours`) are automatically cleaned up.

**Q: Can I use this with other AI CLIs (Codex, Aider, etc.)?**
A: Yes! Implement the `CLIAdapter` interface and register your adapter in the `AdapterRegistry`. See [docs/adapters.md](docs/adapters.md) for a guide.

**Q: What languages/frameworks does the project scanner detect?**
A: The setup wizard detects Node.js (`package.json`), Python (`pyproject.toml`, `requirements.txt`), Go (`go.mod`), Rust (`Cargo.toml`), Java (`pom.xml`, `build.gradle`), Ruby (`Gemfile`), and PHP (`composer.json`).

**Q: Where are logs stored?**
A: Logs are written to `~/.devbridge/logs/devbridge.log`. Use `devbridge logs` to view them or `devbridge logs -f` to follow in real-time.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

[MIT](LICENSE) -- Vinicius Machado