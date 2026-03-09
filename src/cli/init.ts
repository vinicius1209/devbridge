import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { scanForProjects } from './scanner.js';
import { spawnCLI } from '../utils/process.js';

function createRL() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

async function ask(rl: ReturnType<typeof createRL>, question: string): Promise<string> {
  return new Promise(res => rl.question(question, res));
}

export async function init() {
  const rl = createRL();

  console.log('\nDevBridge Setup');
  console.log('===============\n');

  // Step 1 — Detect CLIs
  console.log('Passo 1/4 — Detectando CLIs de AI...');
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
  console.log('\nPasso 2/4 — Telegram Bot');
  console.log('  Crie um bot no Telegram: @BotFather \u2192 /newbot');
  const botToken = await ask(rl, '  Cole o token do seu bot: ');

  if (!botToken.includes(':')) {
    console.error('Token invalido.');
    rl.close();
    process.exit(1);
  }

  // Step 3 — Chat ID
  console.log('\nPasso 3/4 — Seu Chat ID');
  console.log('  Para encontrar seu Chat ID, envie /start para @userinfobot no Telegram.');
  const chatId = await ask(rl, '  Cole seu Chat ID: ');

  // Step 4 — Projects
  console.log('\nPasso 4/4 — Projetos');
  const scanPath = await ask(rl, `  Diretorio para escanear (default: ${homedir()}/projetos): `) || join(homedir(), 'projetos');

  console.log(`  Escaneando ${scanPath}...`);
  const detected = scanForProjects(resolve(scanPath));

  const projects: Record<string, { path: string; adapter: string; description: string }> = {};

  if (detected.length === 0) {
    console.log('  Nenhum projeto encontrado. Voce pode adicionar manualmente no config.');
  } else {
    console.log(`  Encontrados ${detected.length} projeto(s):\n`);
    for (const proj of detected) {
      const include = await ask(rl, `  Incluir ${proj.name} (${proj.type})? (Y/n): `);
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

  // Generate config
  const config = {
    telegram: {
      bot_token: botToken.trim(),
      allowed_users: [chatId.trim()],
    },
    projects,
    commands: {
      test: 'yarn test',
      lint: 'yarn lint',
      build: 'yarn build',
      status: 'git status --short',
      log: 'git log --oneline -10',
    },
    defaults: {
      adapter: hasClaudeV ? 'claude' : 'gemini',
      timeout: 120,
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
  console.log(`  Logs: ~/.devbridge/logs/devbridge.log`);
  console.log(`\nExecute 'devbridge start' ou 'yarn dev' para iniciar!`);

  rl.close();
}
