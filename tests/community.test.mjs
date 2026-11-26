import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRegisterIssueUrl,
  fetchCommunityProfiles,
  isProfileRegistered,
  filterAndSortCommunity
} from '../src/js/community.js';

test('buildRegisterIssueUrl encodes [Register] title with cleaned username', () => {
  const url = buildRegisterIssueUrl('@LucasValeQueiroz');
  assert.ok(url.startsWith('https://github.com/LucasValeQueiroz/github-achievements-tracker/issues/new?'));
  assert.ok(url.includes('title=%5BRegister%5D+LucasValeQueiroz'));
});

test('fetchCommunityProfiles reads profiles map from profiles-snapshot.json', async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      profiles: {
        lucasvalequeiroz: { login: 'LucasValeQueiroz', mergedPullRequests: 116, acceptedAnswers: 14 },
        gaearon: { login: 'gaearon', mergedPullRequests: 2934, acceptedAnswers: 2 }
      }
    })
  });

  const list = await fetchCommunityProfiles({ fetchImpl: mockFetch });
  assert.equal(list.length, 2);
  assert.equal(isProfileRegistered(list, 'lucasvalequeiroz'), true);
  assert.equal(isProfileRegistered(list, 'unknownuser'), false);
});

test('filterAndSortCommunity filters by username and sorts descending by selected metric', () => {
  const sample = [
    { login: 'alice', mergedPullRequests: 50, acceptedAnswers: 12, coAuthoredCommits: 5 },
    { login: 'bob', mergedPullRequests: 200, acceptedAnswers: 2, coAuthoredCommits: 40 },
    { login: 'alicia', mergedPullRequests: 120, acceptedAnswers: 8, coAuthoredCommits: 10 }
  ];

  const byPrs = filterAndSortCommunity(sample, { sortBy: 'mergedPullRequests' });
  assert.equal(byPrs[0].login, 'bob');

  const byGalaxy = filterAndSortCommunity(sample, { sortBy: 'acceptedAnswers' });
  assert.equal(byGalaxy[0].login, 'alice');

  const filtered = filterAndSortCommunity(sample, { query: '@ali', sortBy: 'mergedPullRequests' });
  assert.deepEqual(
    filtered.map((p) => p.login),
    ['alicia', 'alice']
  );
});
