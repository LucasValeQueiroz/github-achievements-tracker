import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectQuickdrawMatches,
  extractTopRepositories,
  extractPrimaryLanguages,
  buildGalaxyBrainSearchLinks,
  analyzeDashboardData
} from '../src/js/analyzer.js';

test('detectQuickdrawMatches enforces exact 5-minute threshold', () => {
  const items = [
    {
      title: 'Fast issue',
      html_url: 'https://github.com/u/r/issues/1',
      created_at: '2026-11-18T10:00:00Z',
      closed_at: '2026-11-18T10:00:05Z'
    },
    {
      title: 'Exact 5 min boundary PR',
      html_url: 'https://github.com/u/r/pull/2',
      pull_request: {},
      created_at: '2026-11-18T10:00:00Z',
      closed_at: '2026-11-18T10:05:00Z'
    },
    {
      title: 'Too slow (5m01s)',
      html_url: 'https://github.com/u/r/issues/3',
      created_at: '2026-11-18T10:00:00Z',
      closed_at: '2026-11-18T10:05:01Z'
    }
  ];

  const matches = detectQuickdrawMatches(items);
  assert.equal(matches.length, 2);
  assert.equal(matches[0].secondsToClose, 5);
  assert.equal(matches[0].type, 'issue');
  assert.equal(matches[1].secondsToClose, 300);
  assert.equal(matches[1].type, 'pr');
});

test('extractTopRepositories excludes forks and ranks by stars descending', () => {
  const repos = [
    { name: 'forked-popular', fork: true, stargazers_count: 500, updated_at: '2026-11-10T00:00:00Z' },
    { name: 'small-app', fork: false, stargazers_count: 3, language: 'Python', updated_at: '2026-11-12T00:00:00Z' },
    { name: 'hit-tool', fork: false, stargazers_count: 24, language: 'TypeScript', updated_at: '2026-11-01T00:00:00Z' }
  ];

  const top = extractTopRepositories(repos, 5);
  assert.equal(top.length, 2);
  assert.equal(top[0].name, 'hit-tool');
  assert.equal(top[0].stars, 24);
});

test('analyzeDashboardData merges API metrics and manual overrides', () => {
  const raw = {
    profile: { login: 'devuser', name: 'Dev User', public_repos: 2, followers: 10 },
    repositories: [
      { name: 'alpha', fork: false, stargazers_count: 18, language: 'JavaScript', updated_at: '2026-11-18T00:00:00Z' },
      { name: 'beta', fork: false, stargazers_count: 2, language: 'JavaScript', updated_at: '2026-11-17T00:00:00Z' }
    ],
    mergedPullRequests: 16,
    recentClosedItems: [
      { title: 'Quick issue', created_at: '2026-11-18T00:00:00Z', closed_at: '2026-11-18T00:00:12Z' }
    ]
  };

  const analysis = analyzeDashboardData(raw, { coAuthoredPullRequests: 1, acceptedAnswers: 2 });
  const byId = Object.fromEntries(analysis.achievements.map((a) => [a.id, a]));

  assert.equal(byId['pull-shark'].progress.currentTier, 'bronze');
  assert.equal(byId.starstruck.progress.currentTier, 'default');
  assert.equal(byId.quickdraw.progress.unlocked, true);
  assert.equal(byId['pair-extraordinaire'].progress.unlocked, true);
  assert.equal(byId['galaxy-brain'].progress.unlocked, true);
  assert.equal(analysis.languages[0].language, 'JavaScript');
  assert.ok(buildGalaxyBrainSearchLinks(analysis.languages)[0].url.includes('JavaScript'));
  assert.equal(extractPrimaryLanguages(raw.repositories)[0].count, 2);
});

test('analyzeDashboardData auto-detects Galaxy Brain, YOLO, Pair Extraordinaire, and Sponsor from autoMetrics', () => {
  const analysis = analyzeDashboardData({
    profile: { login: 'LucasValeQueiroz', name: 'Lucas Vale', public_repos: 12 },
    repositories: [{ name: 'astrobit', stargazers_count: 10, fork: false, language: 'JavaScript' }],
    mergedPullRequests: 83,
    recentClosedItems: [],
    autoMetrics: {
      acceptedAnswers: 4,
      sponsorships: 1,
      yoloUnreviewedPrs: 82,
      coAuthoredPullRequests: 12
    },
    autoSources: {
      acceptedAnswers: 'api',
      sponsorships: 'api',
      yolo: 'api',
      coAuthoredPullRequests: 'api'
    }
  });

  const byId = Object.fromEntries(analysis.achievements.map((a) => [a.id, a]));
  assert.equal(byId['galaxy-brain'].source, 'api');
  assert.equal(byId['galaxy-brain'].progress.value, 4);
  assert.equal(byId['galaxy-brain'].progress.unlocked, true);

  assert.equal(byId['yolo'].source, 'api');
  assert.equal(byId['yolo'].progress.unlocked, true);

  assert.equal(byId['pair-extraordinaire'].source, 'api');
  assert.equal(byId['pair-extraordinaire'].progress.value, 12);

  assert.equal(byId['public-sponsor'].source, 'api');
  assert.equal(byId['public-sponsor'].progress.unlocked, true);
});
