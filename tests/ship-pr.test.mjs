import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArgs,
  parsePorcelainPaths,
  slugifyBranchName,
  detectSensitiveFiles,
  formatCoAuthorTrailer,
  buildCommitMessage,
  buildPrBody,
} from '../scripts/ship-pr.mjs';

test('parseArgs handles PowerShell and POSIX flags cleanly', () => {
  const opts = parseArgs([
    'feat: adiciona filtro',
    '-CoAuthor', 'm4rcelao,octocat',
    '-MergeMethod', 'merge',
    '-DryRun',
  ]);
  assert.equal(opts.message, 'feat: adiciona filtro');
  assert.deepEqual(opts.coAuthors, ['m4rcelao', 'octocat']);
  assert.equal(opts.mergeMethod, 'merge');
  assert.equal(opts.dryRun, true);
  assert.equal(opts.noMerge, false);

  const draftOpts = parseArgs(['--message', 'wip: teste', '--draft', '--base', 'develop']);
  assert.equal(draftOpts.message, 'wip: teste');
  assert.equal(draftOpts.draft, true);
  assert.equal(draftOpts.noMerge, true);
  assert.equal(draftOpts.base, 'develop');
});

test('parseArgs rejects invalid merge method or unknown flags', () => {
  assert.throws(() => parseArgs(['feat: x', '-MergeMethod', 'fast']), /MergeMethod inválido/);
  assert.throws(() => parseArgs(['feat: x', '--unknown']), /Opção desconhecida/);
});

test('slugifyBranchName normalizes accents and conventional prefixes', () => {
  const fixedDate = new Date(2026, 10, 19, 18, 5, 9);
  assert.equal(
    slugifyBranchName('feat(ui): adiciona cálculo de preço!', fixedDate),
    'feat/adiciona-calculo-de-preco-20261119-180509'
  );
  assert.equal(
    slugifyBranchName('Ajusta espaçamento no topo', fixedDate),
    'pr/ajusta-espacamento-no-topo-20261119-180509'
  );
});

test('detectSensitiveFiles blocks secrets while allowing safe templates', () => {
  const flagged = detectSensitiveFiles([
    'src/index.js',
    '.env',
    'apps/api/.env.production',
    '.env.example',
    'config/.env.template',
    'keys/server.pem',
    'credentials.json',
    'README.md',
  ]);
  assert.deepEqual(flagged, [
    '.env',
    'apps/api/.env.production',
    'keys/server.pem',
    'credentials.json',
  ]);
});

test('formatCoAuthorTrailer and buildCommitMessage generate verified trailers', () => {
  const trailer = formatCoAuthorTrailer({
    id: 51460950,
    login: 'm4rcelao',
    name: 'Marcelo',
  });
  assert.equal(trailer, 'Co-authored-by: Marcelo <51460950+m4rcelao@users.noreply.github.com>');

  const raw = formatCoAuthorTrailer('Alice Dev <alice@example.com>');
  assert.equal(raw, 'Co-authored-by: Alice Dev <alice@example.com>');

  const msg = buildCommitMessage('fix: resolve bug', 'Detalhes do ajuste', [trailer, trailer]);
  assert.equal(
    msg,
    'fix: resolve bug\n\nDetalhes do ajuste\n\nCo-authored-by: Marcelo <51460950+m4rcelao@users.noreply.github.com>\n'
  );
});

test('buildPrBody includes summary, files, and co-authors', () => {
  const body = buildPrBody(
    'feat: add ship-pr',
    ['scripts/ship-pr.mjs', 'tests/ship-pr.test.mjs'],
    ['Co-authored-by: Marcelo <51460950+m4rcelao@users.noreply.github.com>']
  );
  assert.match(body, /## Summary/);
  assert.match(body, /`scripts\/ship-pr\.mjs`/);
  assert.match(body, /## Co-authors/);
  assert.match(body, /51460950\+m4rcelao@users\.noreply\.github\.com/);
});

test('parsePorcelainPaths preserves leading-space status lines and renames', () => {
  const raw = ' M README.md\n?? scripts/ship-pr.mjs\nR  old.txt -> new.txt\nA  "spaced file.md"';
  assert.deepEqual(parsePorcelainPaths(raw), [
    'README.md',
    'scripts/ship-pr.mjs',
    'new.txt',
    'spaced file.md',
  ]);
});
