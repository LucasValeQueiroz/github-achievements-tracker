import test from 'node:test';
import assert from 'node:assert/strict';
import { compareProfiles } from '../src/js/comparator.js';
import { analyzeDashboardData } from '../src/js/analyzer.js';

test('compareProfiles computes metric winners, diffs, and tier summaries', () => {
  const left = analyzeDashboardData({
    profile: { login: 'alice', name: 'Alice', followers: 40 },
    repositories: [
      { name: 'app', fork: false, stargazers_count: 20, forks_count: 2, language: 'TypeScript' },
    ],
    mergedPullRequests: 150,
    recentClosedItems: [],
  });

  const right = analyzeDashboardData({
    profile: { login: 'bob', name: 'Bob', followers: 40 },
    repositories: [
      { name: 'lib', fork: false, stargazers_count: 140, forks_count: 10, language: 'Python' },
      { name: 'cli', fork: false, stargazers_count: 10, forks_count: 1, language: 'Python' },
    ],
    mergedPullRequests: 25,
    recentClosedItems: [],
  });

  const result = compareProfiles(left, right);
  assert.equal(result.left.login, 'alice');
  assert.equal(result.left.pullSharkTier, 'Silver');
  assert.equal(result.right.pullSharkTier, 'Bronze');
  assert.equal(result.right.starstruckTier, 'Bronze');

  const byKey = Object.fromEntries(result.rows.map((r) => [r.key, r]));
  assert.equal(byKey.mergedPullRequests.winner, 'left');
  assert.equal(byKey.mergedPullRequests.diff, 125);
  assert.equal(byKey.maxRepoStars.winner, 'right');
  assert.equal(byKey.totalStars.winner, 'right');
  assert.equal(byKey.followers.winner, 'tie');
  assert.equal(result.score.leftWins, 1);
  assert.equal(result.score.rightWins, 2);
  assert.equal(result.score.ties, 2);
});

test('compareProfiles rejects missing analyses', () => {
  assert.throws(() => compareProfiles(null, {}), /required/);
});
