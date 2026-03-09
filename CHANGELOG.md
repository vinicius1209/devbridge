<![CDATA[# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-09

### Added
- Comprehensive README with full documentation
- `CONTRIBUTING.md` guide for contributors
- `docs/` directory with detailed documentation for configuration, plugins, security, and adapters
- `CHANGELOG.md` following keepachangelog.com format

### Changed
- Promoted project to v1.0.0 stable release
- All features from v0.1.0 through v0.5.0 are considered production-ready

## [0.5.0] - 2026-03-02

### Added
- Push notification system via built-in HTTP server
- GitHub webhook endpoint (`/webhook/github`) with HMAC-SHA256 signature verification
- CI/CD notification endpoint (`/webhook/ci`) for pipeline status alerts
- Generic notification endpoint (`/notify`) for custom alerts
- `/notifications` command to toggle notifications on/off from Telegram
- `/mute <minutes>` command to temporarily silence notifications
- Notification filtering by GitHub event type and watched branches
- Per-IP rate limiting on the notification server
- Formatted Telegram messages for push, pull_request, issues, workflow_run, check_run, and pull_request_review events
- Health check endpoint (`GET /health`) for monitoring
- Configurable bind address for the notification server (defaults to `127.0.0.1`)

## [0.4.0] - 2026-02-20

### Added
- Plugin system with `DevBridgePlugin` interface for extending bot functionality
- `PluginLoader` supporting three plugin sources: built-in, local path, and npm packages
- `PluginRegistry` for managing plugin commands with conflict detection
- `PluginContext` providing plugins access to config, logger, messaging, and project info
- `CommandContext` providing plugins with `reply()`, `withTyping()`, and `exec()` helpers
- `@devbridge/plugin-git` -- Git operations via Telegram (`/git status`, `/git log`, `/git diff`, `/git branch`)
- `@devbridge/plugin-github` -- GitHub integration via gh CLI (`/pr list`, `/pr view`, `/issue list`, `/issue view`)
- `/plugins` command to list loaded plugins and their registered commands
- Plugin-specific configuration support (pass object instead of `true` in config)
- Graceful plugin error isolation -- plugin failures do not prevent bot startup

## [0.3.0] - 2026-02-08

### Added
- Interactive setup wizard (`devbridge init`) with 4-step guided configuration
- Automatic AI CLI detection (Claude CLI, Gemini CLI)
- Project scanner that detects Node.js, Python, Go, Rust, Java, Ruby, and PHP projects
- OS service manager for running DevBridge as a background daemon
  - macOS: launchd (LaunchAgents plist)
  - Linux: systemd (user service unit)
- `devbridge start` command to run the bot in foreground
- `devbridge stop` command to stop the background service
- `devbridge logs` command with `-f` flag for real-time log following
- `devbridge status` command to check if the service is running
- File-based logging to `~/.devbridge/logs/devbridge.log`

## [0.2.0] - 2026-01-25

### Added
- Multi-project support with named projects in config
- `/projects` command to list all configured projects
- `/project <name>` command to switch the active project
- `/switch <name>` command to switch between project sessions
- `/sessions` command to list all active sessions with message counts and timestamps
- `/run <alias>` command to execute whitelisted shell commands
- `CommandSandbox` for safe command execution (no `shell: true`, whitelist-only)
- Gemini CLI adapter (`GeminiAdapter`) as an alternative to Claude
- `AdapterRegistry` for managing and auto-detecting available adapters
- Auto-select single project when only one is configured
- Typing indicator while waiting for AI responses
- Smart message splitting for long responses (code block and newline-aware)
- Markdown formatting with automatic fallback to plain text
- Configurable command timeout separate from AI timeout
- Session persistence to disk (`~/.devbridge/sessions.json`)
- Automatic session TTL cleanup on startup

### Changed
- Config format updated from `project` (singular) to `projects` (plural) with backward compatibility

## [0.1.0] - 2026-01-10

### Added
- Initial MVP release
- Telegram bot using grammY framework with long polling
- Claude CLI integration for AI-powered code assistance via Telegram
- Chat ID-based authentication (whitelist only)
- Single project support with configurable path and adapter
- Session management with UUID-based CLI session tracking
- `/help` and `/start` commands
- `/clear` command to reset the current AI session
- `/status` command showing session info (adapter, model, message count, timestamps)
- Configuration via `devbridge.config.json`
- Read-only AI tool restrictions (Read, Glob, Grep only)
- Graceful error handling with automatic session recovery

[1.0.0]: https://github.com/vinicius1209/devbridge/compare/v0.5.0...v1.0.0
[0.5.0]: https://github.com/vinicius1209/devbridge/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/vinicius1209/devbridge/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/vinicius1209/devbridge/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/vinicius1209/devbridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vinicius1209/devbridge/releases/tag/v0.1.0
]]>