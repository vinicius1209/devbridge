<![CDATA[# Configuration Reference

DevBridge is configured through a `devbridge.config.json` file in your working directory. This document describes every option in detail.

## Generating the Config

The recommended way to create your config is with the interactive setup wizard:

```bash
npx devbridge init
```

Alternatively, copy the example file:

```bash
cp devbridge.config.example.json devbridge.config.json
```

> **Important**: `devbridge.config.json` contains your bot token and is listed in `.gitignore`. Never commit it to version control.

---

## `telegram` (required)

Telegram bot credentials and access control.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `bot_token` | `string` | Yes | Your Telegram bot token from [@BotFather](https://t.me/BotFather). Format: `123456:ABC-DEF...` |
| `allowed_users` | `string[]` | Yes | Array of Telegram chat IDs that are allowed to use the bot. Get your ID from [@userinfobot](https://t.me/userinfobot) |

```json
{
  "telegram": {
    "bot_token": "7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "allowed_users": ["123456789", "987654321"]
  }
}
```

**Notes**:
- Chat IDs are stored as strings, not numbers
- At least one chat ID is required
- Messages from unlisted chat IDs are silently ignored (no error response)

---

## `projects` (required)

A map of named projects. Each project points to a local directory and specifies which AI adapter to use.

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `path` | `string` | Yes | -- | Absolute path to the project root directory. Must exist on disk |
| `adapter` | `"claude" \| "gemini"` | No | Value from `defaults.adapter` | Which AI CLI to use for this project |
| `model` | `string` | No | Value from `defaults.model` | Model name to pass to the AI CLI (e.g., `"sonnet"`, `"opus"`) |
| `description` | `string` | No | -- | Human-readable description shown in `/projects` output |
| `permission_level` | `"readonly" \| "read-write" \| "full"` | No | `"readonly"` | Controls which AI tools are available and whether permissions are auto-approved. See [security.md](security.md) for details |
| `allowed_tools` | `string` | No | Derived from `permission_level` | Explicit comma-separated list of allowed tools, overriding the permission level mapping. Advanced use only |
| `skip_permissions` | `boolean` | No | Derived from `permission_level` | If `true`, the AI CLI skips interactive permission prompts (Claude: `--dangerously-skip-permissions`, Gemini: `--yolo`). Advanced use only |

```json
{
  "projects": {
    "frontend": {
      "path": "/home/user/projects/frontend",
      "adapter": "claude",
      "model": "sonnet",
      "description": "React frontend app",
      "permission_level": "read-write"
    },
    "backend": {
      "path": "/home/user/projects/backend",
      "adapter": "gemini",
      "description": "Go API server"
    }
  }
}
```

**Notes**:
- At least one project must be configured
- The project name (key) is used in `/project <name>` and `/switch <name>` commands
- If only one project is configured, it is automatically selected as active
- Project paths are resolved to absolute paths at load time
- The config loader validates that all paths exist on startup

### Backward Compatibility (v0.1 format)

The legacy `project` (singular) key is still supported for backward compatibility:

```json
{
  "project": {
    "name": "my-app",
    "path": "/path/to/project",
    "adapter": "claude"
  }
}
```

This is automatically migrated to the `projects` format at runtime. A deprecation warning is logged.

---

## `commands` (optional)

A map of command aliases to shell commands. These are the only commands that `/run` can execute.

| Key | Value | Description |
|-----|-------|-------------|
| Alias name | Shell command string | The actual command to run |

```json
{
  "commands": {
    "test": "yarn test",
    "lint": "yarn lint",
    "build": "yarn build",
    "status": "git status --short",
    "log": "git log --oneline -10",
    "deploy": "bash deploy.sh"
  }
}
```

**Usage**: `/run test` executes `yarn test` in the active project's directory.

**Security Notes**:
- Commands are executed **without** `shell: true` -- the command string is split on whitespace and the first token is used as the binary
- Only explicitly listed commands can be executed; there is no way to run arbitrary commands
- Each command runs with a configurable timeout (`defaults.command_timeout`)
- Commands inherit the server's environment variables

---

## `plugins` (optional)

A map of plugin names to their configuration. Plugins extend DevBridge with new commands.

| Key | Value | Description |
|-----|-------|-------------|
| Plugin name | `true`, `false`, or `object` | Enable, disable, or configure the plugin |

```json
{
  "plugins": {
    "@devbridge/plugin-git": true,
    "@devbridge/plugin-github": true,
    "my-custom-plugin": false,
    "@devbridge/some-plugin": { "apiKey": "xxx" }
  }
}
```

**Plugin resolution order**:
1. Built-in plugins in the `plugins/` directory (names matching `@devbridge/plugin-*`)
2. Local absolute paths (starting with `/`)
3. npm packages (installed in `node_modules/`)

**Notes**:
- Set to `false` to disable a plugin without removing it
- Set to `true` to enable with default settings
- Pass an object to provide plugin-specific configuration (accessible via `context.pluginConfig`)
- Plugin load errors are logged but do not prevent bot startup

---

## `defaults` (optional)

Default values for various settings.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `"claude" \| "gemini"` | `"claude"` | Default adapter when a project does not specify one |
| `model` | `string` | `undefined` | Default model passed to the AI CLI. If unset, the CLI's default is used |
| `timeout` | `number` | `120` | Maximum seconds to wait for an AI response before timing out (non-streaming mode) |
| `stream_timeout` | `number` | `3600` | Hard maximum seconds for a streaming AI response. Acts as a safety net |
| `inactivity_timeout` | `number` | `300` | Seconds of no stdout/stderr output before a streaming AI process is killed |
| `max_message_length` | `number` | `4096` | Maximum characters per Telegram message chunk. Responses exceeding this are split |
| `session_ttl_hours` | `number` | `24` | Hours of inactivity after which a session is automatically cleaned up |
| `command_timeout` | `number` | `60` | Maximum seconds for `/run` command execution |

```json
{
  "defaults": {
    "adapter": "claude",
    "model": "sonnet",
    "timeout": 120,
    "stream_timeout": 3600,
    "inactivity_timeout": 300,
    "max_message_length": 4096,
    "session_ttl_hours": 24,
    "command_timeout": 60
  }
}
```

---

## `notifications` (optional)

Configuration for the push notification HTTP server. When enabled, DevBridge starts an HTTP server alongside the Telegram bot to receive webhooks and push notifications.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` (when section present) | Enable or disable the notification server |
| `port` | `number` | `9876` | Port for the HTTP server |
| `bind` | `string` | `"127.0.0.1"` | Address to bind the server to. Use `"0.0.0.0"` for external access |
| `secret` | `string` | `undefined` | Shared secret for GitHub webhook HMAC-SHA256 signature verification |
| `github_events` | `string[]` | `["push", "pull_request", "issues", "workflow_run"]` | GitHub event types to forward as Telegram notifications |
| `watched_branches` | `string[]` | `["main", "master", "develop"]` | For push events, only notify pushes to these branches |
| `rate_limit.max_per_minute` | `number` | `30` | Maximum webhook requests allowed per IP per minute |
| `rate_limit.cooldown_seconds` | `number` | `5` | Minimum seconds between notifications |

```json
{
  "notifications": {
    "enabled": true,
    "port": 9876,
    "bind": "127.0.0.1",
    "secret": "my-github-webhook-secret",
    "github_events": ["push", "pull_request", "issues", "workflow_run"],
    "watched_branches": ["main", "master", "develop"],
    "rate_limit": {
      "max_per_minute": 30,
      "cooldown_seconds": 5
    }
  }
}
```

### Supported GitHub Event Types

The following event types have formatted Telegram messages:

- `push` -- Commit pushes (filtered by `watched_branches`)
- `pull_request` -- PR opened, closed, merged
- `issues` -- Issue opened, closed
- `workflow_run` -- GitHub Actions workflow completions
- `check_run` -- Check suite results
- `pull_request_review` -- PR review submitted

Any other event type configured in `github_events` will be forwarded with a generic format.

### HTTP Endpoints

When the notification server is enabled, the following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check. Returns `{"status": "ok", "uptime": <seconds>}` |
| `/notify` | POST | Generic notification. Body: `{"title": "...", "message": "...", "level": "info\|success\|warning\|error", "project": "..."}` |
| `/webhook/github` | POST | GitHub webhook receiver. Validates `X-Hub-Signature-256` header when `secret` is set |
| `/webhook/ci` | POST | CI pipeline notification. Body: `{"status": "success\|failure", "pipeline": "...", "project": "...", "url": "...", "duration": "..."}` |

---

## Full Example

```json
{
  "telegram": {
    "bot_token": "7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "allowed_users": ["123456789"]
  },
  "projects": {
    "frontend": {
      "path": "/home/user/projects/frontend",
      "adapter": "claude",
      "model": "sonnet",
      "description": "React SPA",
      "permission_level": "read-write"
    },
    "backend": {
      "path": "/home/user/projects/backend",
      "adapter": "gemini",
      "description": "Go API",
      "permission_level": "readonly"
    }
  },
  "commands": {
    "test": "yarn test",
    "lint": "yarn lint",
    "build": "yarn build",
    "status": "git status --short",
    "log": "git log --oneline -10"
  },
  "plugins": {
    "@devbridge/plugin-git": true,
    "@devbridge/plugin-github": true
  },
  "defaults": {
    "adapter": "claude",
    "timeout": 120,
    "stream_timeout": 3600,
    "inactivity_timeout": 300,
    "max_message_length": 4096,
    "session_ttl_hours": 24,
    "command_timeout": 60
  },
  "notifications": {
    "enabled": true,
    "port": 9876,
    "secret": "my-webhook-secret",
    "github_events": ["push", "pull_request", "workflow_run"],
    "watched_branches": ["main", "develop"],
    "rate_limit": {
      "max_per_minute": 30,
      "cooldown_seconds": 5
    }
  }
}
```

## Environment and File Locations

| Item | Path | Description |
|------|------|-------------|
| Config file | `./devbridge.config.json` | Main configuration (working directory) |
| Session store | `~/.devbridge/sessions.json` | Persisted session data |
| Log file | `~/.devbridge/logs/devbridge.log` | Application logs |
| macOS service | `~/Library/LaunchAgents/com.devbridge.bot.plist` | launchd service definition |
| Linux service | `~/.config/systemd/user/devbridge.service` | systemd user service |
]]>