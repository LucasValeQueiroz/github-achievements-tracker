import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGitHubNoReplyEmail,
  formatCoAuthorTrailer,
  buildCoAuthoredCommit,
  resolveCollaborator
} from '../src/js/coauthor.js';
import {
  buildAchievementShield,
  buildMarkdownReport,
  buildJsonReport
} from '../src/js/exporter.js';
import { githubRequest, GitHubApiError } from '../src/js/github-api.js';
import { analyzeDashboardData } from '../src/js/analyzer.js';

test('co-author helpers format valid GitHub noreply emails and git commit commands', async () => {
  const email = buildGitHubNoReplyEmail({ id: 142512124, login: 'LucasValeQueiroz' });
  assert.equal(email, '142512124+LucasValeQueiroz@users.noreply.github.com');

  const trailer = formatCoAuthorTrailer({ name: 'Lucas Vale', email });
  assert.equal(trailer, 'Co-authored-by: Lucas Vale <142512124+LucasValeQueiroz@users.noreply.github.com>');

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    headers: new Map([['x-ratelimit-limit', '60'], ['x-ratelimit-remaining', '59']]),
    json: async () => ({ id: 583231, login: 'octocat', name: 'The Octocat', avatar_url: 'https://example.com/a.png' })
  });

  const resolved = await resolveCollaborator('octocat', { fetchImpl: mockFetch });
  assert.equal(resolved.email, '583231+octocat@users.noreply.github.com');

  const commit = buildCoAuthoredCommit('feat: pair test', [resolved]);
  assert.ok(commit.fullMessage.includes('Co-authored-by: The Octocat <583231+octocat@users.noreply.github.com>'));
  assert.ok(commit.gitCommand.startsWith('git commit -m "feat: pair test"'));
});

test('Markdown and JSON exporters render shields and structured payload', () => {
  const analysis = analyzeDashboardData({
    profile: { login: 'LucasValeQueiroz', name: 'Lucas Vale' },
    repositories: [],
    mergedPullRequests: 16,
    recentClosedItems: []
  });

  const pullShark = analysis.achievements.find((a) => a.id === 'pull-shark');
  const shield = buildAchievementShield(pullShark);
  assert.ok(shield.includes('Pull_Shark-Bronze-cd7f32'));

  const mdPt = buildMarkdownReport(analysis, 'pt');
  assert.ok(mdPt.includes('Progresso de GitHub Achievements — @LucasValeQueiroz'));
  assert.ok(mdPt.includes('Pull Shark'));

  const jsonParsed = JSON.parse(buildJsonReport(analysis));
  assert.equal(jsonParsed.schemaVersion, '1.0');
  assert.equal(jsonParsed.profile.login, 'LucasValeQueiroz');
});

test('githubRequest raises typed GitHubApiError on 404 and 403 rate limits', async () => {
  const fetch404 = async () => ({
    ok: false,
    status: 404,
    headers: new Map(),
    json: async () => ({ message: 'Not Found' })
  });

  await assert.rejects(
    () => githubRequest('/users/does-not-exist', { fetchImpl: fetch404 }),
    (err) => err instanceof GitHubApiError && err.code === 'NOT_FOUND' && err.status === 404
  );

  const fetchRateLimit = async () => ({
    ok: false,
    status: 403,
    headers: new Map([['x-ratelimit-limit', '60'], ['x-ratelimit-remaining', '0']]),
    json: async () => ({ message: 'API rate limit exceeded' })
  });

  await assert.rejects(
    () => githubRequest('/users/octocat', { fetchImpl: fetchRateLimit }),
    (err) => err instanceof GitHubApiError && err.code === 'RATE_LIMITED'
  );
});
