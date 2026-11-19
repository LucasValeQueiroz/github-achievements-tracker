#!/usr/bin/env node

/**
 * Ship-PR — Fast, safe GitHub Flow CLI helper.
 * Creates a short-lived feature branch, commits real changes (with optional
 * GitHub-verified Co-authored-by trailers), opens a Pull Request via `gh`,
 * merges it cleanly, deletes the branch, and syncs the base branch.
 *
 * Zero external dependencies — requires only Node.js >= 18, git, and GitHub CLI (`gh`).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONVENTIONAL_PREFIXES = new Set([
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
]);

const MERGE_METHODS = new Set(['squash', 'merge', 'rebase']);

const SAFE_ENV_EXAMPLES = /\.(example|sample|template|dist)$/i;
const SENSITIVE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^(credentials|secrets?)\.json$/i,
  /^service[-_]?account.*\.json$/i,
];

const USAGE_TEXT = `
Ship-PR — GitHub Flow em 1 comando (branch -> commit -> PR -> merge -> sync)

Uso:
  Ship-PR "<mensagem do commit/PR>" [opções]

Opções (aceita estilo PowerShell -Flag ou POSIX --flag):
  -CoAuthor, --coauthor, -c <users>   Coautor(es) no GitHub (ex.: m4rcelao ou "u1,u2")
  -Base, --base <branch>              Branch alvo (padrão: default branch do repo)
  -Branch, --branch <nome>            Nome customizado da branch
  -MergeMethod, --merge-method <tipo> squash (padrão) | merge | rebase
  -Body, --body <texto>               Descrição extra para o corpo do PR
  -NoMerge, --no-merge                Abre o PR mas não faz merge automático
  -Draft, --draft                     Abre como Draft PR (implica -NoMerge)
  -All, --all, -a                     Inclui todas as alterações mesmo se já houver arquivos em stage
  -AllowSensitive, --allow-sensitive  Permite commitar arquivos sinalizados como sensíveis
  -DryRun, --dry-run                  Mostra o plano sem alterar git ou GitHub
  -Help, --help, -h                   Exibe esta ajuda

Exemplos:
  Ship-PR "feat: adiciona filtro por data"
  Ship-PR "fix: corrige calculo de frete" -CoAuthor m4rcelao
  Ship-PR "docs: melhora guia de instalacao" -NoMerge
  Ship-PR "refactor: simplifica parser" -DryRun
`.trim();

/**
 * Parse CLI arguments supporting both PowerShell (-Flag) and POSIX (--flag) syntax.
 */
export function parseArgs(argv) {
  const opts = {
    message: '',
    coAuthors: [],
    base: '',
    branch: '',
    mergeMethod: 'squash',
    body: '',
    noMerge: false,
    draft: false,
    all: false,
    allowSensitive: false,
    dryRun: false,
    help: false,
  };

  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const lower = raw.toLowerCase();

    if (lower === '-h' || lower === '-help' || lower === '--help' || lower === '/?') {
      opts.help = true;
      continue;
    }
    if (lower === '-nomerge' || lower === '--no-merge' || lower === '-no-merge') {
      opts.noMerge = true;
      continue;
    }
    if (lower === '-draft' || lower === '--draft') {
      opts.draft = true;
      opts.noMerge = true;
      continue;
    }
    if (lower === '-dryrun' || lower === '--dry-run' || lower === '-dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (lower === '-a' || lower === '-all' || lower === '--all') {
      opts.all = true;
      continue;
    }
    if (lower === '-allowsensitive' || lower === '--allow-sensitive' || lower === '-allow-sensitive') {
      opts.allowSensitive = true;
      continue;
    }

    const nextValue = (flagName) => {
      if (i + 1 >= argv.length) {
        throw new Error(`Faltou informar o valor para ${flagName}.`);
      }
      return argv[++i];
    };

    if (lower === '-c' || lower === '-coauthor' || lower === '--coauthor' || lower === '--co-author') {
      const val = nextValue(raw);
      for (const item of val.split(',')) {
        const trimmed = item.trim();
        if (trimmed) opts.coAuthors.push(trimmed);
      }
      continue;
    }
    if (lower === '-base' || lower === '--base') {
      opts.base = nextValue(raw).trim();
      continue;
    }
    if (lower === '-branch' || lower === '--branch') {
      opts.branch = nextValue(raw).trim();
      continue;
    }
    if (lower === '-mergemethod' || lower === '--merge-method' || lower === '-merge-method') {
      const method = nextValue(raw).trim().toLowerCase();
      if (!MERGE_METHODS.has(method)) {
        throw new Error(`MergeMethod inválido "${method}". Use: squash, merge ou rebase.`);
      }
      opts.mergeMethod = method;
      continue;
    }
    if (lower === '-body' || lower === '--body') {
      opts.body = nextValue(raw);
      continue;
    }
    if (lower === '-m' || lower === '-message' || lower === '--message') {
      opts.message = nextValue(raw).trim();
      continue;
    }
    if (raw.startsWith('-')) {
      throw new Error(`Opção desconhecida: ${raw}. Use Ship-PR -Help para ver as opções.`);
    }

    positional.push(raw);
  }

  if (!opts.message && positional.length > 0) {
    opts.message = positional.join(' ').trim();
  }

  return opts;
}

/**
 * Convert a commit/PR message into a clean, collision-free Git branch name.
 */
export function slugifyBranchName(message, now = new Date()) {
  const match = message.match(/^([a-zA-Z]+)(?:\([^)]+\))?:\s*(.+)$/);
  let prefix = 'pr';
  let subject = message;

  if (match && CONVENTIONAL_PREFIXES.has(match[1].toLowerCase())) {
    prefix = match[1].toLowerCase();
    subject = match[2];
  }

  const slug = subject
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42)
    .replace(/-+$/, '') || 'update';

  const pad = (n) => String(n).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');

  return `${prefix}/${slug}-${stamp}`;
}

/**
 * Identify potentially sensitive files (e.g., .env, private keys, credentials)
 * while allowing safe template files like .env.example.
 */
export function detectSensitiveFiles(filePaths) {
  const flagged = [];
  for (const filePath of filePaths) {
    const normalized = filePath.replace(/\\/g, '/').trim();
    if (!normalized) continue;
    const base = path.posix.basename(normalized);
    if (SAFE_ENV_EXAMPLES.test(base)) continue;
    if (SENSITIVE_PATTERNS.some((re) => re.test(base))) {
      flagged.push(normalized);
    }
  }
  return flagged;
}

/**
 * Format a GitHub user object or raw "Name <email>" string into a verified Co-authored-by trailer.
 */
export function formatCoAuthorTrailer(entry) {
  if (typeof entry === 'string') {
    const cleaned = entry.replace(/^Co-authored-by:\s*/i, '').trim();
    if (/^.+\s+<[^<>@\s]+@[^<>@\s]+>$/.test(cleaned)) {
      return `Co-authored-by: ${cleaned}`;
    }
    throw new Error(`Formato de coautor inválido: "${entry}". Informe um username do GitHub ou "Nome <email>".`);
  }

  if (!entry || !entry.id || !entry.login) {
    throw new Error('Dados do usuário GitHub incompletos para gerar Co-authored-by.');
  }

  const displayName = (entry.name || entry.login).trim();
  const login = entry.login.trim();
  return `Co-authored-by: ${displayName} <${entry.id}+${login}@users.noreply.github.com>`;
}

/**
 * Build a Git commit message with optional body and deduplicated Co-authored-by trailers.
 */
export function buildCommitMessage(title, body = '', coAuthorTrailers = []) {
  const parts = [title.trim()];
  const trimmedBody = (body || '').trim();
  if (trimmedBody) {
    parts.push(trimmedBody);
  }
  const uniqueTrailers = [...new Set(coAuthorTrailers.map((t) => t.trim()).filter(Boolean))];
  if (uniqueTrailers.length > 0) {
    parts.push(uniqueTrailers.join('\n'));
  }
  return parts.join('\n\n') + '\n';
}

/**
 * Build a clean Pull Request description summarizing changed files and co-authors.
 */
export function buildPrBody(title, changedFiles = [], coAuthorTrailers = [], extraBody = '') {
  const lines = ['## Summary'];
  if (extraBody && extraBody.trim()) {
    lines.push(extraBody.trim());
  } else {
    lines.push(`- ${title.trim()}`);
  }

  if (changedFiles.length > 0) {
    lines.push('', '## Changed Files');
    const preview = changedFiles.slice(0, 20);
    for (const file of preview) {
      lines.push(`- \`${file}\``);
    }
    if (changedFiles.length > preview.length) {
      lines.push(`- _...and ${changedFiles.length - preview.length} more file(s)_`);
    }
  }

  if (coAuthorTrailers.length > 0) {
    lines.push('', '## Co-authors');
    for (const trailer of coAuthorTrailers) {
      lines.push(`- \`${trailer}\``);
    }
  }

  return lines.join('\n') + '\n';
}

function runCmd(bin, args, options = {}) {
  const { trim = true, ...execOpts } = options;
  try {
    const out = execFileSync(bin, args, {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...execOpts,
    });
    return trim ? out.trim() : out.replace(/(\r?\n)+$/, '');
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const stdout = err.stdout ? String(err.stdout).trim() : '';
    const detail = stderr || stdout || err.message;
    throw new Error(`Falha ao executar \`${bin} ${args.join(' ')}\`:\n${detail}`);
  }
}

export function parsePorcelainPaths(porcelainOutput) {
  if (!porcelainOutput) return [];
  const files = [];
  for (const line of porcelainOutput.split(/\r?\n/)) {
    if (!line || line.length < 4) continue;
    let filePart = line.slice(3).trim();
    if (filePart.includes(' -> ')) {
      filePart = filePart.split(' -> ').pop().trim();
    }
    if (filePart.startsWith('"') && filePart.endsWith('"')) {
      filePart = filePart.slice(1, -1);
    }
    if (filePart) files.push(filePart);
  }
  return files;
}

function resolveDefaultBranch() {
  try {
    const branch = runCmd('gh', ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name']);
    if (branch) return branch;
  } catch {
    // Fallback to local git remote HEAD
  }
  try {
    const ref = runCmd('git', ['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const match = ref.match(/refs\/remotes\/origin\/(.+)$/);
    if (match) return match[1];
  } catch {
    // Fallback to main
  }
  return 'main';
}

function resolveCoAuthors(rawList) {
  if (!rawList || rawList.length === 0) return [];

  let currentLogin = '';
  try {
    currentLogin = runCmd('gh', ['api', 'user', '--jq', '.login']).toLowerCase();
  } catch {
    // Best-effort self check
  }

  const trailers = [];
  for (const raw of rawList) {
    if (/^.+\s+<[^<>@\s]+@[^<>@\s]+>$/.test(raw.replace(/^Co-authored-by:\s*/i, '').trim())) {
      trailers.push(formatCoAuthorTrailer(raw));
      continue;
    }

    const username = raw.replace(/^@/, '').trim();
    if (!username) continue;

    if (currentLogin && username.toLowerCase() === currentLogin) {
      console.warn(`[aviso] "@${username}" é a sua própria conta; o GitHub não conta auto-coautoria para Pair Extraordinaire.`);
    }

    const json = runCmd('gh', ['api', `users/${username}`]);
    const user = JSON.parse(json);
    trailers.push(formatCoAuthorTrailer(user));
  }

  return [...new Set(trailers)];
}

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(USAGE_TEXT);
    return 0;
  }

  if (!opts.message) {
    console.error('Erro: informe a mensagem do commit/PR.\n');
    console.error('Exemplo: Ship-PR "feat: adiciona filtro por data"');
    console.error('Use Ship-PR -Help para ver todas as opções.');
    return 1;
  }

  // 1. Pre-flight repo & gh checks
  const repoRoot = runCmd('git', ['rev-parse', '--show-toplevel']);
  runCmd('gh', ['auth', 'status']);

  const baseBranch = opts.base || resolveDefaultBranch();
  const currentBranch = runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

  // 2. Inspect changes (respecting selective staging unless -All)
  const stagedRaw = runCmd('git', ['diff', '--cached', '--name-only']);
  const stagedFiles = stagedRaw ? stagedRaw.split(/\r?\n/).filter(Boolean) : [];
  const porcelain = runCmd('git', ['status', '--porcelain', '-uall'], { trim: false });
  const allChangedFiles = parsePorcelainPaths(porcelain);

  const willStageAll = opts.all || stagedFiles.length === 0;
  const filesToCommit = willStageAll ? allChangedFiles : stagedFiles;

  let unpushedAhead = 0;
  if (currentBranch !== baseBranch) {
    try {
      const count = runCmd('git', ['rev-list', '--count', `${baseBranch}..HEAD`]);
      unpushedAhead = Number.parseInt(count, 10) || 0;
    } catch {
      unpushedAhead = 0;
    }
  }

  if (filesToCommit.length === 0 && unpushedAhead === 0) {
    console.error('Nenhuma alteração detectada para commitar. Edite algum arquivo real antes de rodar Ship-PR.');
    return 1;
  }

  // 3. Guard against accidentally committing sensitive files
  if (!opts.allowSensitive && filesToCommit.length > 0) {
    const sensitive = detectSensitiveFiles(filesToCommit);
    if (sensitive.length > 0) {
      console.error('Bloqueado por segurança — arquivo(s) sensível(is) detectado(s):');
      for (const f of sensitive) console.error(`  - ${f}`);
      console.error('Adicione ao .gitignore ou rode com -AllowSensitive se tiver certeza.');
      return 1;
    }
  }

  // 4. Resolve branch name & verified co-authors
  const needNewBranch = currentBranch === baseBranch;
  const targetBranch = needNewBranch
    ? (opts.branch || slugifyBranchName(opts.message))
    : currentBranch;

  const coAuthorTrailers = resolveCoAuthors(opts.coAuthors);
  const commitMsg = buildCommitMessage(opts.message, opts.body, coAuthorTrailers);
  const prBody = buildPrBody(opts.message, filesToCommit, coAuthorTrailers, opts.body);

  console.log(`\nShip-PR (${path.basename(repoRoot)})`);
  console.log(`  Base:   ${baseBranch}`);
  console.log(`  Branch: ${targetBranch}${needNewBranch ? ' (nova)' : ' (atual)'}`);
  console.log(`  Merge:  ${opts.draft ? 'Draft PR (sem merge)' : opts.noMerge ? 'Apenas abrir PR' : `--${opts.mergeMethod} + delete-branch`}`);
  if (filesToCommit.length > 0) {
    console.log(`  Arquivos (${filesToCommit.length}): ${filesToCommit.slice(0, 6).join(', ')}${filesToCommit.length > 6 ? ` (+${filesToCommit.length - 6})` : ''}`);
  } else {
    console.log(`  Commits já prontos na branch: ${unpushedAhead}`);
  }
  if (coAuthorTrailers.length > 0) {
    for (const t of coAuthorTrailers) console.log(`  ${t}`);
  }

  if (opts.dryRun) {
    console.log('\n[DryRun] Mensagem de commit que seria usada:');
    console.log('---');
    console.log(commitMsg.trim());
    console.log('---');
    console.log('[DryRun] Nenhuma alteração foi feita no git ou no GitHub.');
    return 0;
  }

  // 5. Execute GitHub Flow
  if (needNewBranch) {
    runCmd('git', ['checkout', '-b', targetBranch]);
  }

  if (filesToCommit.length > 0) {
    if (willStageAll) {
      runCmd('git', ['add', '-A']);
    }
    runCmd('git', ['commit', '-F', '-'], { input: commitMsg });
  }

  console.log('\nEnviando branch para origin...');
  runCmd('git', ['push', '-u', 'origin', targetBranch]);

  console.log('Abrindo Pull Request...');
  const prCreateArgs = [
    'pr', 'create',
    '--base', baseBranch,
    '--head', targetBranch,
    '--title', opts.message,
    '--body-file', '-',
  ];
  if (opts.draft) prCreateArgs.push('--draft');
  const prUrl = runCmd('gh', prCreateArgs, { input: prBody });
  console.log(`PR criado: ${prUrl}`);

  if (opts.noMerge || opts.draft) {
    console.log('PR aberto sem merge automático (conforme solicitado).');
    return 0;
  }

  console.log(`Fazendo merge (--${opts.mergeMethod}) e removendo branch...`);
  const mergeArgs = ['pr', 'merge', prUrl, `--${opts.mergeMethod}`, '--delete-branch'];
  let mergeInput;
  if (opts.mergeMethod === 'squash') {
    mergeArgs.push('--subject', opts.message, '--body-file', '-');
    const squashBodyParts = [];
    if (opts.body && opts.body.trim()) squashBodyParts.push(opts.body.trim());
    if (coAuthorTrailers.length > 0) squashBodyParts.push(coAuthorTrailers.join('\n'));
    mergeInput = (squashBodyParts.length > 0 ? squashBodyParts.join('\n\n') : `Merged via Ship-PR (${prUrl})`) + '\n';
  }
  runCmd('gh', mergeArgs, mergeInput ? { input: mergeInput } : {});

  // Ensure local repo is back on baseBranch and cleanly synced
  const afterBranch = runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (afterBranch !== baseBranch) {
    runCmd('git', ['checkout', baseBranch]);
  }
  try {
    runCmd('git', ['pull', '--ff-only', 'origin', baseBranch]);
  } catch {
    console.warn(`[aviso] Não foi possível dar fast-forward automático em ${baseBranch}; rode \`git pull\` se necessário.`);
  }

  console.log(`\nConcluído! PR mergeado e ${baseBranch} sincronizada: ${prUrl}`);
  return 0;
}

const isMain = process.argv[1]
  && path.resolve(fs.realpathSync(process.argv[1])) === path.resolve(fs.realpathSync(fileURLToPath(import.meta.url)));

if (isMain) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error(`\nErro: ${err.message}`);
    process.exitCode = 1;
  }
}
