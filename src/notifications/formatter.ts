import type { GenericNotification, CINotification } from './types.js';

const LEVEL_EMOJI: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

export function formatGeneric(notif: GenericNotification): string {
  const emoji = LEVEL_EMOJI[notif.level ?? 'info'];
  const project = notif.project ? `[${notif.project}] ` : '';
  return `${emoji} ${project}${notif.title}\n${notif.message}`;
}

export function formatGitHubEvent(eventType: string, payload: Record<string, unknown>): string | null {
  switch (eventType) {
    case 'push':
      return formatPush(payload);
    case 'pull_request':
      return formatPR(payload);
    case 'issues':
      return formatIssue(payload);
    case 'workflow_run':
      return formatWorkflow(payload);
    case 'check_run':
      return formatCheckRun(payload);
    case 'pull_request_review':
      return formatReview(payload);
    default:
      return `🔔 GitHub: ${eventType}`;
  }
}

function getRepoName(payload: Record<string, unknown>): string {
  const repo = payload.repository as Record<string, unknown> | undefined;
  return (repo?.name as string) ?? 'unknown';
}

function formatPush(payload: Record<string, unknown>): string {
  const repo = getRepoName(payload);
  const ref = (payload.ref as string)?.replace('refs/heads/', '') ?? 'unknown';
  const commits = (payload.commits as Array<Record<string, unknown>>) ?? [];
  const pusher = (payload.pusher as Record<string, unknown>)?.name ?? 'unknown';

  let text = `📦 [${repo}] Push para ${ref}\nAutor: ${pusher}\nCommits: ${commits.length}\n`;

  const shown = commits.slice(0, 10);
  for (const c of shown) {
    const sha = (c.id as string)?.slice(0, 7) ?? '';
    const msg = (c.message as string)?.split('\n')[0] ?? '';
    text += `\n• ${sha} ${msg}`;
  }

  if (commits.length > 10) {
    text += `\n... e mais ${commits.length - 10} commits`;
  }

  return text;
}

function formatPR(payload: Record<string, unknown>): string {
  const repo = getRepoName(payload);
  const action = payload.action as string;
  const pr = payload.pull_request as Record<string, unknown>;
  const number = pr?.number ?? '?';
  const title = pr?.title ?? '';
  const user = (pr?.user as Record<string, unknown>)?.login ?? 'unknown';
  const head = (pr?.head as Record<string, unknown>)?.ref ?? '';
  const base = (pr?.base as Record<string, unknown>)?.ref ?? '';

  switch (action) {
    case 'opened':
      return `🔀 [${repo}] PR #${number} aberto\n${title}\nAutor: ${user}\nBranch: ${head} → ${base}`;
    case 'closed': {
      const merged = pr?.merged === true;
      return merged
        ? `✅ [${repo}] PR #${number} mergeado\n${title}\nPor: ${user}`
        : `❌ [${repo}] PR #${number} fechado\n${title}\nPor: ${user}`;
    }
    default:
      return `🔀 [${repo}] PR #${number} ${action}\n${title}`;
  }
}

function formatIssue(payload: Record<string, unknown>): string {
  const repo = getRepoName(payload);
  const action = payload.action as string;
  const issue = payload.issue as Record<string, unknown>;
  const number = issue?.number ?? '?';
  const title = issue?.title ?? '';
  const user = (issue?.user as Record<string, unknown>)?.login ?? 'unknown';
  const labels = ((issue?.labels as Array<Record<string, unknown>>) ?? [])
    .map(l => l.name)
    .join(', ');

  const emoji = action === 'closed' ? '✅' : '📝';
  let text = `${emoji} [${repo}] Issue #${number} ${action === 'opened' ? 'aberta' : action}\n${title}\nAutor: ${user}`;
  if (labels) text += `\nLabels: ${labels}`;
  return text;
}

function formatWorkflow(payload: Record<string, unknown>): string {
  const repo = getRepoName(payload);
  const wf = payload.workflow_run as Record<string, unknown>;
  const name = wf?.name ?? 'unknown';
  const conclusion = wf?.conclusion as string ?? 'unknown';
  const branch = (wf?.head_branch as string) ?? '';
  const url = wf?.html_url as string ?? '';

  const emoji = conclusion === 'success' ? '✅' : '❌';
  let text = `${emoji} [${repo}] CI Pipeline ${conclusion}\nWorkflow: ${name}\nBranch: ${branch}`;
  if (url) text += `\nDetalhes: ${url}`;
  return text;
}

function formatCheckRun(payload: Record<string, unknown>): string {
  const repo = getRepoName(payload);
  const check = payload.check_run as Record<string, unknown>;
  const name = check?.name ?? 'unknown';
  const conclusion = check?.conclusion as string ?? 'unknown';
  const emoji = conclusion === 'success' ? '✅' : conclusion === 'failure' ? '❌' : '⏳';
  return `${emoji} [${repo}] Check: ${name} — ${conclusion}`;
}

function formatReview(payload: Record<string, unknown>): string {
  const repo = getRepoName(payload);
  const review = payload.review as Record<string, unknown>;
  const pr = payload.pull_request as Record<string, unknown>;
  const state = review?.state as string ?? 'unknown';
  const user = (review?.user as Record<string, unknown>)?.login ?? 'unknown';
  const number = pr?.number ?? '?';

  const emoji = state === 'approved' ? '✅' : state === 'changes_requested' ? '🔄' : '💬';
  return `${emoji} [${repo}] Review em PR #${number}\nPor: ${user}\nStatus: ${state}`;
}

export function formatCI(ci: CINotification): string {
  const emoji = ci.status === 'success' ? '✅' : '❌';
  const project = ci.project ? `[${ci.project}] ` : '';
  let text = `${emoji} ${project}CI Pipeline ${ci.status}\nPipeline: ${ci.pipeline}`;
  if (ci.duration) text += `\nDuracao: ${ci.duration}`;
  if (ci.url) text += `\nDetalhes: ${ci.url}`;
  return text;
}
