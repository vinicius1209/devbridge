import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { scanForProjects } from './scanner.js';
import { spawnCLI } from '../utils/process.js';
import type { PermissionLevel } from '../types.js';

function createRL() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

async function ask(rl: ReturnType<typeof createRL>, question: string): Promise<string> {
  return new Promise(res => rl.question(question, res));
}

async function telegramApi(token: string, method: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  const data = await res.json() as { ok: boolean; result: unknown };
  if (!data.ok) throw new Error(`Telegram API error: ${method}`);
  return data.result;
}

async function pollForChatId(token: string, rl: ReturnType<typeof createRL>): Promise<string> {
  try {
    // Get bot info
    const me = await telegramApi(token, 'getMe') as { username: string };
    console.log(`  Bot detectado: @${me.username}`);

    // Drain old updates
    const old = await telegramApi(token, 'getUpdates') as Array<{ update_id: number }>;
    let offset = old.length > 0 ? old[old.length - 1].update_id + 1 : 0;

    console.log(`\n  Envie qualquer mensagem para @${me.username} no Telegram...`);
    console.log('  Aguardando mensagem (60s)...\n');

    // Poll for new messages
    for (let i = 0; i < 30; i++) {
      const updates = await telegramApi(token, 'getUpdates', {
        offset: String(offset),
        timeout: '2',
      }) as Array<{
        update_id: number;
        message?: { chat: { id: number; first_name?: string }; from?: { first_name?: string } };
      }>;

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message?.chat?.id) {
          const chatId = String(update.message.chat.id);
          const name = update.message.from?.first_name ?? update.message.chat.first_name ?? '';
          const nameStr = name ? ` (${name})` : '';

          const confirm = await ask(rl, `  Encontrado! Chat ID: ${chatId}${nameStr}. Correto? (Y/n): `);
          if (confirm.toLowerCase() !== 'n') {
            return chatId;
          }
        }
      }
    }

    console.log('  Timeout. Nenhuma mensagem recebida.');
  } catch {
    console.log('  Nao foi possivel conectar a API do Telegram.');
  }

  // Fallback to manual
  return ask(rl, '  Cole seu Chat ID manualmente: ');
}

interface PermissionOption {
  label: string;
  level: PermissionLevel;
}

const PERMISSION_OPTIONS: Record<string, PermissionOption> = {
  '1': {
    label: 'Somente leitura (padrao seguro)',
    level: 'readonly',
  },
  '2': {
    label: 'Leitura + Escrita (pode criar e editar arquivos)',
    level: 'read-write',
  },
  '3': {
    label: 'Acesso completo (leitura, escrita, comandos shell, agentes)',
    level: 'full',
  },
};

export async function init() {
  const rl = createRL();

  console.log('\nDevBridge Setup');
  console.log('===============\n');

  // Step 1 — Detect CLIs
  console.log('Passo 1/5 — Detectando CLIs de AI...');
  const claudeResult = await spawnCLI('claude', ['--version'], { cwd: process.cwd(), timeout: 10 });
  const geminiResult = await spawnCLI('gemini', ['--version'], { cwd: process.cwd(), timeout: 10 });

  const hasClaudeV = claudeResult.exitCode === 0;
  const hasGeminiV = geminiResult.exitCode === 0;

  console.log(`  ${hasClaudeV ? '\u2714' : '\u2718'} Claude CLI ${hasClaudeV ? 'encontrada' : 'nao encontrada'}`);
  console.log(`  ${hasGeminiV ? '\u2714' : '\u2718'} Gemini CLI ${hasGeminiV ? 'encontrada' : 'nao encontrada'}`);

  if (!hasClaudeV && !hasGeminiV) {
    console.error('\nNenhuma CLI de AI encontrada. Instale Claude CLI ou Gemini CLI.');
    rl.close();
    process.exit(1);
  }

  // Step 2 — Bot token
  console.log('\nPasso 2/5 — Telegram Bot');
  console.log('  Crie um bot no Telegram: @BotFather \u2192 /newbot');
  const botToken = await ask(rl, '  Cole o token do seu bot: ');

  if (!botToken.includes(':')) {
    console.error('Token invalido.');
    rl.close();
    process.exit(1);
  }

  // Step 3 — Chat ID (auto-discovery)
  console.log('\nPasso 3/5 — Seu Chat ID');
  const chatId = await pollForChatId(botToken.trim(), rl);

  // Step 4 — Projects
  console.log('\nPasso 4/5 — Projetos');
  const scanPath = await ask(rl, `  Diretorio para escanear (default: ${homedir()}/projetos): `) || join(homedir(), 'projetos');

  console.log(`  Escaneando ${scanPath}...`);
  const detected = scanForProjects(resolve(scanPath));

  const projects: Record<string, {
    path: string;
    adapter: string;
    description: string;
    permission_level?: PermissionLevel;
  }> = {};

  if (detected.length === 0) {
    console.log('  Nenhum projeto encontrado. Voce pode adicionar manualmente no config.');
  } else {
    console.log(`  Encontrados ${detected.length} projeto(s):\n`);
    for (const proj of detected) {
      const cmdHint = Object.keys(proj.suggestedCommands).length > 0
        ? ` [${Object.keys(proj.suggestedCommands).join(', ')}]`
        : '';
      const include = await ask(rl, `  Incluir ${proj.name} (${proj.type}${cmdHint})? (Y/n): `);
      if (include.toLowerCase() !== 'n') {
        const defaultAdapter = hasClaudeV ? 'claude' : 'gemini';
        const adapter = hasClaudeV && hasGeminiV
          ? await ask(rl, `    Adapter (claude/gemini, default: ${defaultAdapter}): `) || defaultAdapter
          : defaultAdapter;

        projects[proj.name] = {
          path: proj.path,
          adapter,
          description: `${proj.type} project`,
        };
      }
    }
  }

  // Step 5 — Permission levels per project
  if (Object.keys(projects).length > 0) {
    console.log('\nPasso 5/5 — Nivel de permissao por projeto');
    console.log('  Define o que a AI pode fazer em cada projeto:\n');
    console.log('  1) Somente leitura — apenas consulta o codigo');
    console.log('  2) Leitura + Escrita — pode criar e editar arquivos');
    console.log('  3) Acesso completo — leitura, escrita, comandos shell, agentes\n');

    for (const [name, proj] of Object.entries(projects)) {
      const choice = await ask(rl, `  ${name} — nivel de permissao (1/2/3, default: 1): `) || '1';
      const option = PERMISSION_OPTIONS[choice] ?? PERMISSION_OPTIONS['1'];

      if (option.level !== 'readonly') {
        proj.permission_level = option.level;
      }

      console.log(`    → ${option.label}\n`);
    }
  }

  // Build smart commands from detected projects
  const commands: Record<string, string> = {
    status: 'git status --short',
    log: 'git log --oneline -10',
  };

  const includedProjects = detected.filter(p => projects[p.name]);
  const commandSlots = ['test', 'lint', 'build', 'dev'];
  for (const slot of commandSlots) {
    for (const proj of includedProjects) {
      if (proj.suggestedCommands[slot] && !commands[slot]) {
        commands[slot] = proj.suggestedCommands[slot];
        break;
      }
    }
  }

  // Generate config
  const config = {
    telegram: {
      bot_token: botToken.trim(),
      allowed_users: [chatId.trim()],
    },
    projects,
    commands,
    defaults: {
      adapter: hasClaudeV ? 'claude' : 'gemini',
      timeout: 120,
      stream_timeout: 3600,
      inactivity_timeout: 300,
      max_message_length: 4096,
      session_ttl_hours: 24,
      command_timeout: 60,
    },
  };

  const configPath = resolve(process.cwd(), 'devbridge.config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Create .devbridge dir
  const devbridgeDir = join(homedir(), '.devbridge');
  if (!existsSync(devbridgeDir)) {
    mkdirSync(devbridgeDir, { recursive: true });
  }

  console.log(`\nResumo`);
  console.log(`======`);
  console.log(`  Config: ${configPath}`);
  console.log(`  Projetos: ${Object.keys(projects).length} configurados`);
  console.log(`  Comandos: ${Object.keys(commands).join(', ')}`);
  console.log(`  Logs: ~/.devbridge/logs/devbridge.log`);
  console.log(`\nExecute 'devbridge start' ou 'yarn dev' para iniciar!`);

  rl.close();
}
