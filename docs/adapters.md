<![CDATA[# Adapter Development Guide

Adapters are the bridge between DevBridge and AI CLI tools. This guide explains how adapters work and how to create your own.

## Overview

An adapter wraps a CLI tool (like `claude` or `gemini`) and exposes a uniform interface that DevBridge uses to send messages and manage sessions. DevBridge ships with two built-in adapters:

- **ClaudeAdapter** (`src/adapters/claude.ts`) -- Wraps the Claude CLI
- **GeminiAdapter** (`src/adapters/gemini.ts`) -- Wraps the Gemini CLI

## The CLIAdapter Interface

Every adapter must implement the `CLIAdapter` interface defined in `src/types.ts`:

```typescript
interface CLIAdapter {
  name: string;

  isAvailable(): Promise<boolean>;
  // Check if the CLI binary is installed and accessible.
  // Called at startup to detect available adapters.

  chat(message: string, sessionId: string, options: ChatOptions & { cwd: string }): Promise<string>;
  // Send a message to the AI and return the response text.
  // - message: the user's text from Telegram
  // - sessionId: unique identifier for the conversation session
  // - options.model: optional model name override
  // - options.timeout: max seconds to wait (default: 120)
  // - options.cwd: project directory to run the CLI in

  newSession(projectPath: string): string;
  // Create a new session and return its ID.
  // Called when the user starts a new conversation or after /clear.

  clearSession(sessionId: string): void;
  // Clean up resources associated with a session.
  // Called when the user runs /clear or when sessions expire.
}
```

Supporting types:

```typescript
type AdapterName = 'claude' | 'gemini';  // Extend this union for new adapters

interface ChatOptions {
  model?: string;
  timeout?: number;
}
```

## Step-by-Step: Creating a New Adapter

Let's create an adapter for a hypothetical "Codex CLI" tool.

### Step 1: Create the Adapter File

Create `src/adapters/codex.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { CLIAdapter, ChatOptions } from '../types.js';
import { spawnCLI } from '../utils/process.js';
import { logger } from '../utils/logger.js';

export class CodexAdapter implements CLIAdapter {
  name = 'codex';

  async isAvailable(): Promise<boolean> {
    // Check if the CLI binary exists by running a version check
    const result = await spawnCLI('codex', ['--version'], {
      cwd: process.cwd(),
      timeout: 10,
    });
    return result.exitCode === 0;
  }

  async chat(
    message: string,
    sessionId: string,
    options: ChatOptions & { cwd: string }
  ): Promise<string> {
    // Build the CLI arguments
    const args = [
      '--prompt', message,
      '--session', sessionId,
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

    const timeout = options.timeout ?? 120;

    logger.debug('Codex CLI call', { sessionId });

    const result = await spawnCLI('codex', args, {
      cwd: options.cwd,
      timeout,
    });

    // Handle timeout
    if (result.timedOut) {
      throw new Error(
        `Timeout -- Codex took longer than ${timeout}s. Try again or /clear.`
      );
    }

    // Handle errors
    if (result.exitCode !== 0) {
      const errorMsg = result.stderr || result.stdout || 'Unknown error';
      logger.error('Codex CLI error', {
        exitCode: result.exitCode,
        stderr: result.stderr,
      });
      throw new Error(`Processing error: ${errorMsg.slice(0, 200)}`);
    }

    return result.stdout || '(empty response)';
  }

  newSession(_projectPath: string): string {
    const sessionId = uuidv4();
    logger.info('New Codex session', { sessionId });
    return sessionId;
  }

  clearSession(sessionId: string): void {
    logger.info('Codex session cleared', { sessionId });
  }
}
```

### Step 2: Update the AdapterName Type

In `src/types.ts`, add `'codex'` to the union:

```typescript
export type AdapterName = 'claude' | 'gemini' | 'codex';
```

### Step 3: Register the Adapter

In `src/adapters/index.ts`, import and register the adapter:

```typescript
import { ClaudeAdapter } from './claude.js';
import { GeminiAdapter } from './gemini.js';
import { CodexAdapter } from './codex.js';

export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new ClaudeAdapter());
  registry.register(new GeminiAdapter());
  registry.register(new CodexAdapter());
  return registry;
}
```

### Step 4: Use It

In your `devbridge.config.json`:

```json
{
  "projects": {
    "my-app": {
      "path": "/path/to/project",
      "adapter": "codex"
    }
  }
}
```

---

## How the Adapter is Used

Understanding the full lifecycle helps you build a robust adapter.

### 1. Startup Detection

When DevBridge starts, it calls `isAvailable()` on every registered adapter. This is used to:
- Warn if a configured project uses an unavailable adapter
- Report available adapters in the startup log

```
[INFO] Available adapters: claude, gemini
[WARN] Project "my-app" uses codex but it's not installed
```

### 2. Session Creation

When a user sends their first message to a project, `SessionManager.getOrCreate()` calls `adapter.newSession(projectPath)`. The returned session ID is stored and used for all subsequent messages.

### 3. Chat Flow

For each user message:

1. The `router.ts` handler retrieves the session and adapter
2. A typing indicator is shown in Telegram
3. `adapter.chat(message, sessionId, options)` is called
4. The response is split into chunks and sent back to Telegram
5. The session's `messageCount` and `lastMessageAt` are updated

### 4. Session Clearing

When the user runs `/clear` or a session expires:
1. `adapter.clearSession(sessionId)` is called for cleanup
2. The session is removed from the store

---

## The `spawnCLI` Utility

DevBridge provides `src/utils/process.ts` with a `spawnCLI` function that handles:

- Process spawning with `spawn()` (no `shell: true`)
- Timeout management (SIGTERM followed by SIGKILL)
- Immediate stdin closure (prevents hanging)
- stdout/stderr capture
- Error handling (spawn failures, permission errors)

```typescript
interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

function spawnCLI(
  command: string,
  args: string[],
  options: { cwd: string; timeout: number }
): Promise<SpawnResult>;
```

Use this utility in your adapter to get consistent behavior with the rest of the system.

---

## The AdapterRegistry

The `AdapterRegistry` class (`src/adapters/index.ts`) provides:

```typescript
class AdapterRegistry {
  register(adapter: CLIAdapter): void;
  // Add an adapter to the registry

  get(name: string): CLIAdapter;
  // Get an adapter by name (throws if not found)

  getAvailable(): Promise<CLIAdapter[]>;
  // Return all adapters where isAvailable() returns true

  getAll(): CLIAdapter[];
  // Return all registered adapters regardless of availability
}
```

---

## Built-in Adapter Details

### ClaudeAdapter

- **Binary**: `claude`
- **Session management**: Uses `--session-id` and `--resume` flags for multi-turn conversations
- **Output format**: `--output-format text`
- **Safety**: Restricts tools to `Read,Glob,Grep` via `--allowedTools`
- **Session tracking**: An in-memory `Set<string>` tracks active sessions to decide when to use `--resume`
- **Error recovery**: Detects corrupted sessions from error messages and signals for automatic cleanup

### GeminiAdapter

- **Binary**: `gemini`
- **Session management**: Uses `-p` flag for prompts (session continuity depends on Gemini CLI capabilities)
- **Output format**: Uses CLI defaults
- **Safety**: No DevBridge-side tool restrictions; relies on Gemini CLI's own safety configuration

---

## Tips for Adapter Development

1. **Version check**: Use `--version` or `--help` in `isAvailable()` with a short timeout (10 seconds).

2. **Error messages**: Truncate error messages to ~200 characters before throwing. Telegram has message limits and long stack traces are not useful to the user.

3. **Session state**: If your CLI does not support session IDs natively, you may need to manage conversation history yourself (e.g., appending messages to a file or maintaining context in memory).

4. **Timeout handling**: Always respect the timeout option. Users expect to be able to recover from hung processes with `/clear`.

5. **Logging**: Use the shared `logger` for debug, info, and error messages. This ensures all adapter activity appears in the unified log file.

6. **stdin closure**: Close stdin immediately after spawning to prevent the CLI from waiting for input. The `spawnCLI` utility handles this automatically.

7. **Model passthrough**: Pass the `model` option to the CLI if supported. This allows users to configure different models per project.
]]>