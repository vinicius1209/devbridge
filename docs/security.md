<![CDATA[# Security Model

DevBridge is designed to bridge your Telegram to local AI CLI tools and shell commands. Because it grants remote access to your machine's file system and command execution, security is built into every layer.

## Security Layers

### 1. Telegram Chat ID Whitelist

**File**: `src/security/auth.ts`

The first line of defense is a strict whitelist of Telegram chat IDs. Only users whose numeric chat ID appears in the `telegram.allowed_users` array can interact with the bot.

```json
{
  "telegram": {
    "allowed_users": ["123456789"]
  }
}
```

**How it works**:
- A grammY middleware intercepts every incoming message
- The sender's `chat.id` is checked against the whitelist
- Unauthorized messages are silently ignored (no response is sent)
- Unauthorized attempts are logged with `logger.warn`

**Recommendations**:
- Only add your own chat ID and those of trusted collaborators
- Periodically review the `allowed_users` list
- Each user gets independent project selection and session state

### 2. Command Sandbox (Whitelist-Only Execution)

**File**: `src/security/sandbox.ts`

The `/run` command does not execute arbitrary shell commands. It uses a **whitelist** defined in your config file.

```json
{
  "commands": {
    "test": "yarn test",
    "lint": "yarn lint",
    "build": "yarn build"
  }
}
```

**How it works**:
- The `CommandSandbox` class maps aliases to pre-defined commands
- `/run test` resolves `"test"` to `"yarn test"` from the whitelist
- If the alias is not in the whitelist, execution is refused
- Commands are spawned using Node.js `spawn()` **without `shell: true`**
- The command string is split on whitespace; the first token is the binary, the rest are arguments

**Why no `shell: true`**:
Using `shell: true` would allow shell metacharacters (`|`, `;`, `&&`, `$()`, backticks) to be interpreted, which could lead to command injection. By spawning processes directly, DevBridge ensures that each argument is passed literally.

**Timeout protection**:
- Each command has a configurable timeout (`defaults.command_timeout`, default: 60 seconds)
- When a timeout is reached, the process receives `SIGTERM` followed by `SIGKILL` after 5 seconds
- stdin is immediately closed to prevent commands from hanging on input

**Recommendations**:
- Only whitelist commands you trust
- Avoid whitelisting commands that accept user input from arguments (the alias itself is the only input)
- Use specific commands rather than generic wrappers

### 3. Configurable Permission Levels

**Files**: `src/adapters/permissions.ts`, `src/adapters/claude.ts`, `src/adapters/gemini.ts`

Each project has a `permission_level` that controls which AI tools are available and whether interactive permission prompts are skipped. The default is `"readonly"`.

| Level | AI Can Do | Permissions Auto-Approved |
|-------|-----------|--------------------------|
| `readonly` (default) | Read files, search files and contents | No |
| `read-write` | All of the above + create, write, and edit files | Yes |
| `full` | All of the above + execute shell commands, access the network, run agents | Yes |

**Tool mapping per adapter**:

| Level | Claude CLI (`--allowedTools`) | Gemini CLI (`--allowed-tools`) |
|-------|------------------------------|-------------------------------|
| `readonly` | `Read,Glob,Grep` | `ReadFileTool,ReadManyFilesTool,GlobTool,GrepTool` |
| `read-write` | `Read,Glob,Grep,Write,Edit,MultiEdit` | Above + `WriteFileTool,EditTool` |
| `full` | Above + `Bash,WebFetch,WebSearch,Agent,NotebookEdit` | Above + `ShellTool,WebFetchTool,WebSearchTool` |

**Permission bypass flags**:
- `read-write` and `full` levels automatically pass `--dangerously-skip-permissions` (Claude) or `--yolo` (Gemini) to avoid interactive prompts that would block the CLI process
- The `readonly` level does not skip permissions since read-only tools do not trigger prompts

**Advanced overrides**: You can bypass the permission level mapping entirely by setting `allowed_tools` (explicit tool list) or `skip_permissions` (explicit bypass flag) on a project. These take precedence over the `permission_level` defaults.

```json
{
  "projects": {
    "my-app": {
      "path": "/path/to/project",
      "adapter": "claude",
      "permission_level": "read-write"
    }
  }
}
```

### 4. Webhook Signature Verification

**File**: `src/notifications/routes.ts`

When a `secret` is configured in the notifications section, incoming GitHub webhooks are verified using HMAC-SHA256:

```json
{
  "notifications": {
    "secret": "your-webhook-secret"
  }
}
```

**How it works**:
- GitHub signs each webhook payload with your shared secret
- The signature is sent in the `X-Hub-Signature-256` HTTP header
- DevBridge computes `sha256=HMAC(secret, body)` and compares using `crypto.timingSafeEqual`
- Requests with invalid or missing signatures receive a `401 Unauthorized` response

**Why `timingSafeEqual`**: Regular string comparison (`===`) is vulnerable to timing attacks where an attacker can determine how many characters of the signature match. `timingSafeEqual` takes constant time regardless of where the strings differ.

### 5. Rate Limiting

**File**: `src/notifications/rate-limiter.ts`

The notification HTTP server enforces per-IP rate limits to prevent abuse and denial-of-service attacks.

```json
{
  "notifications": {
    "rate_limit": {
      "max_per_minute": 30,
      "cooldown_seconds": 5
    }
  }
}
```

**How it works**:
- Each incoming request's IP address is tracked
- A sliding window of 60 seconds is maintained per IP
- If the number of requests from an IP exceeds `max_per_minute`, the server returns `429 Too Many Requests`
- Old timestamps outside the window are automatically cleaned up

### 6. Local Bind Address

**File**: `src/notifications/server.ts`

The notification server binds to `127.0.0.1` by default, meaning it only accepts connections from the local machine.

```json
{
  "notifications": {
    "bind": "127.0.0.1"
  }
}
```

**Why this matters**: If you run DevBridge on a server with a public IP, binding to `127.0.0.1` ensures that the notification endpoints are not accessible from the internet.

**If you need external access** (e.g., to receive GitHub webhooks from the internet):
- Use a reverse proxy (nginx, Caddy) with HTTPS termination
- Configure a webhook `secret` for HMAC verification
- Set appropriate firewall rules
- Consider only allowing GitHub's IP ranges

### 7. Notification Muting

**File**: `src/notifications/filters.ts`

The `/mute` and `/notifications off` commands allow users to temporarily or permanently silence notifications. While not a security feature per se, this prevents notification flooding from being used to harass authorized users.

**How it works**:
- `/mute 60` sets a `mutedUntil` timestamp 60 minutes in the future
- `/notifications off` sets a mute effectively forever
- When muted, incoming webhook requests receive a `200` response with `{"status": "muted"}` but no Telegram message is sent
- `/notifications on` clears the mute immediately

---

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Unauthorized Telegram user sends commands | Chat ID whitelist silently drops messages |
| Arbitrary command execution via `/run` | Command whitelist + no `shell: true` |
| AI modifies or deletes files | Default `readonly` permission level restricts tools to Read/Glob/Grep. Higher levels (`read-write`, `full`) grant write or shell access intentionally |
| Forged GitHub webhooks | HMAC-SHA256 signature verification with timing-safe comparison |
| Webhook flood / DDoS | Per-IP rate limiting + local bind address |
| Config file exposure | `devbridge.config.json` is in `.gitignore` |
| Session data leakage | Sessions stored in `~/.devbridge/` (user home, not project dir) |
| Command injection via shell metacharacters | `spawn()` without `shell: true` prevents interpretation |
| Long-running commands consuming resources | Configurable timeout with SIGTERM/SIGKILL escalation |

---

## Recommendations

1. **Keep your bot token secret** -- Never commit `devbridge.config.json` to version control
2. **Use a webhook secret** -- Always configure `notifications.secret` when exposing the HTTP server
3. **Minimize the command whitelist** -- Only whitelist commands you actually need
4. **Review `allowed_users` regularly** -- Remove chat IDs of people who should no longer have access
5. **Use a reverse proxy** -- If exposing the notification server externally, terminate TLS at the proxy
6. **Monitor logs** -- Check `~/.devbridge/logs/devbridge.log` for unauthorized access attempts
7. **Keep CLIs updated** -- Ensure Claude CLI, Gemini CLI, and `gh` CLI are up to date with the latest security patches
8. **Use `readonly` for projects that don't need write access** -- The default `readonly` permission level is the safest option. Only escalate to `read-write` or `full` for projects where the AI genuinely needs to create or modify files. Review your permission levels periodically
]]>