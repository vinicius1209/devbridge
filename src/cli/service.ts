import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';
import { logger } from '../utils/logger.js';

interface ServiceConfig {
  name: string;
  execPath: string;
  workDir: string;
  logPath: string;
  autoStart: boolean;
}

interface ServiceManager {
  install(config: ServiceConfig): Promise<void>;
  uninstall(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  getLogs(lines: number): Promise<string>;
}

class LaunchdManager implements ServiceManager {
  private plistPath = join(homedir(), 'Library', 'LaunchAgents', 'com.devbridge.bot.plist');
  private label = 'com.devbridge.bot';

  async install(config: ServiceConfig): Promise<void> {
    const logDir = join(homedir(), '.devbridge', 'logs');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

    const nodePath = execSync('which node').toString().trim();
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${this.label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${config.execPath}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${config.workDir}</string>
  <key>RunAtLoad</key>
  <${config.autoStart ? 'true' : 'false'}/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${config.logPath}</string>
  <key>StandardErrorPath</key>
  <string>${config.logPath}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`;

    writeFileSync(this.plistPath, plist);
    logger.info('launchd plist installed', { path: this.plistPath });
  }

  async uninstall(): Promise<void> {
    await this.stop();
    if (existsSync(this.plistPath)) {
      unlinkSync(this.plistPath);
    }
  }

  async start(): Promise<void> {
    try {
      execSync(`launchctl load ${this.plistPath}`);
    } catch {
      logger.warn('launchctl load failed — may already be loaded');
    }
  }

  async stop(): Promise<void> {
    try {
      execSync(`launchctl unload ${this.plistPath}`);
    } catch {
      // May not be loaded
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const output = execSync(`launchctl list | grep ${this.label}`).toString();
      return output.includes(this.label);
    } catch {
      return false;
    }
  }

  async getLogs(lines: number): Promise<string> {
    const logPath = join(homedir(), '.devbridge', 'logs', 'devbridge.log');
    if (!existsSync(logPath)) return 'No logs yet.';
    try {
      return execSync(`tail -n ${lines} "${logPath}"`).toString();
    } catch {
      return 'Failed to read logs.';
    }
  }
}

class SystemdManager implements ServiceManager {
  private serviceName = 'devbridge';
  private servicePath = join(homedir(), '.config', 'systemd', 'user', 'devbridge.service');

  async install(config: ServiceConfig): Promise<void> {
    const dir = join(homedir(), '.config', 'systemd', 'user');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const nodePath = execSync('which node').toString().trim();
    const unit = `[Unit]
Description=DevBridge Telegram Bot
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${config.execPath}
WorkingDirectory=${config.workDir}
Restart=always
RestartSec=5
StandardOutput=append:${config.logPath}
StandardError=append:${config.logPath}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production

[Install]
WantedBy=default.target`;

    writeFileSync(this.servicePath, unit);
    execSync('systemctl --user daemon-reload');
    if (config.autoStart) {
      execSync(`systemctl --user enable ${this.serviceName}`);
    }
  }

  async uninstall(): Promise<void> {
    await this.stop();
    try { execSync(`systemctl --user disable ${this.serviceName}`); } catch { /* may not be enabled */ }
    if (existsSync(this.servicePath)) unlinkSync(this.servicePath);
    try { execSync('systemctl --user daemon-reload'); } catch { /* best effort */ }
  }

  async start(): Promise<void> {
    execSync(`systemctl --user start ${this.serviceName}`);
  }

  async stop(): Promise<void> {
    try {
      execSync(`systemctl --user stop ${this.serviceName}`);
    } catch { /* may not be running */ }
  }

  async isRunning(): Promise<boolean> {
    try {
      const output = execSync(`systemctl --user is-active ${this.serviceName}`).toString().trim();
      return output === 'active';
    } catch {
      return false;
    }
  }

  async getLogs(lines: number): Promise<string> {
    const logPath = join(homedir(), '.devbridge', 'logs', 'devbridge.log');
    if (!existsSync(logPath)) return 'No logs yet.';
    try {
      return execSync(`tail -n ${lines} "${logPath}"`).toString();
    } catch {
      return 'Failed to read logs.';
    }
  }
}

export function createServiceManager(): ServiceManager {
  if (platform() === 'darwin') return new LaunchdManager();
  if (platform() === 'linux') return new SystemdManager();
  throw new Error('OS nao suportado para servico. Use `devbridge start` para rodar manualmente.');
}
