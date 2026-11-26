import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAchievementsHtml,
  mapBadgeTiersToMetrics,
  resolveLiveUserAchievements
} from '../api/achievements.js';
import {
  fetchLocalProfileSnapshot,
  fetchUserDashboardData,
  readDashboardCache,
  writeDashboardCache
} from '../src/js/github-api.js';
import { analyzeDashboardData } from '../src/js/analyzer.js';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
}

test('parseAchievementsHtml extracts official badges and highest tiers from GitHub HTML', () => {
  const sampleHtml = `
    <div>
      <img alt="Achievement: Pull Shark" />
      <span class="achievement-tier-label achievement-tier-label--silver">x3</span>
    </div>
    <div>
      <img alt="Achievement: Galaxy Brain" />
      <span class="achievement-tier-label achievement-tier-label--bronze">x2</span>
    </div>
    <div>
      <img alt="Achievement: Quickdraw" />
    </div>
    <div>
      <img alt="Achievement: Public Sponsor" />
    </div>
    <div>
      <img alt="Achievement: YOLO" />
    </div>
  `;

  const badges = parseAchievementsHtml(sampleHtml);
  assert.deepEqual(badges, {
    'pull-shark': 'silver',
    'galaxy-brain': 'bronze',
    quickdraw: 'default',
    'public-sponsor': 'default',
    yolo: 'default'
  });

  const metrics = mapBadgeTiersToMetrics(badges);
  assert.equal(metrics.mergedPullRequestsFloor, 128);
  assert.equal(metrics.acceptedAnswers, 8);
  assert.equal(metrics.sponsorships, 1);
  assert.equal(metrics.yoloUnreviewedPrs, 1);
  assert.equal(metrics.quickdrawUnlocked, true);
});

test('resolveLiveUserAchievements works for any username without a server token', async () => {
  const mockFetch = async (url) => {
    assert.ok(url.includes('https://github.com/octocat?tab=achievements'));
    return {
      ok: true,
      status: 200,
      text: async () => `
        <img alt="Achievement: Galaxy Brain" />
        <img alt="Achievement: Pair Extraordinaire" />
        <span class="achievement-tier-label achievement-tier-label--bronze">x2</span>
      `
    };
  };

  const result = await resolveLiveUserAchievements('octocat', { fetchImpl: mockFetch });
  assert.equal(result.login, 'octocat');
  assert.equal(result.acceptedAnswers, 2);
  assert.equal(result.coAuthoredCommits, 10);
  assert.equal(result.source, 'badges');
});

test('fetchLocalProfileSnapshot resolves multi-user profiles-snapshot.json case-insensitively', async () => {
  const mockFetch = async (url) => {
    if (url.includes('profiles-snapshot.json')) {
      return {
        ok: true,
        json: async () => ({
          updatedAt: '2026-11-26T00:00:00Z',
          profiles: {
            gaearon: {
              login: 'gaearon',
              acceptedAnswers: 12,
              sponsorships: 3
            }
          }
        })
      };
    }
    return { ok: false, status: 404 };
  };

  const snap = await fetchLocalProfileSnapshot('Gaearon', {
    fetchImpl: mockFetch,
    forceBrowserCheck: false
  });
  assert.equal(snap.login, 'gaearon');
  assert.equal(snap.acceptedAnswers, 12);
  assert.equal(snap.sponsorships, 3);
});

test('fetchUserDashboardData enriches any user via live proxy, caches result, and respects forceRefresh', async () => {
  const storage = createMemoryStorage();
  let profileCalls = 0;

  const mockFetch = async (url) => {
    const headers = new Map([['x-ratelimit-limit', '60'], ['x-ratelimit-remaining', '55']]);
    if (url.endsWith('/users/anydev')) {
      profileCalls += 1;
      return {
        ok: true,
        status: 200,
        headers,
        json: async () => ({ login: 'anydev', name: 'Any Dev', public_repos: 1, followers: 5 })
      };
    }
    if (url.includes('/users/anydev/repos')) {
      return {
        ok: true,
        status: 200,
        headers,
        json: async () => [{ name: 'cool-repo', fork: false, stargazers_count: 20, language: 'JS' }]
      };
    }
    if (url.includes('/search/')) {
      // Simulate temporary unauthenticated Search API rate limit
      return {
        ok: false,
        status: 403,
        headers: new Map([['x-ratelimit-limit', '10'], ['x-ratelimit-remaining', '0']]),
        json: async () => ({ message: 'API rate limit exceeded' })
      };
    }
    if (url.includes('/api/achievements?user=anydev')) {
      return {
        ok: true,
        status: 200,
        headers,
        json: async () => ({
          login: 'anydev',
          acceptedAnswers: 8,
          sponsorships: 1,
          mergedPullRequests: 16,
          yoloUnreviewedPrs: 1,
          coAuthoredCommits: 10,
          quickdrawUnlocked: true
        })
      };
    }
    return { ok: false, status: 404, headers, json: async () => ({}) };
  };

  const first = await fetchUserDashboardData('anydev', {
    fetchImpl: mockFetch,
    proxyUrl: 'https://tracker.example.com/api/achievements',
    storage
  });

  assert.equal(first.fromCache, false);
  assert.equal(first.liveSyncSource, 'live-proxy');
  assert.equal(first.mergedPullRequests, 16);
  assert.equal(first.autoMetrics.acceptedAnswers, 8);
  assert.equal(first.autoMetrics.sponsorships, 1);
  assert.equal(first.autoMetrics.quickdrawUnlocked, true);

  const analysis = analyzeDashboardData(first);
  const byId = Object.fromEntries(analysis.achievements.map((a) => [a.id, a]));
  assert.equal(byId['galaxy-brain'].progress.currentTier, 'bronze');
  assert.equal(byId['public-sponsor'].progress.unlocked, true);
  assert.equal(byId.quickdraw.progress.unlocked, true);
  assert.equal(byId['pull-shark'].progress.currentTier, 'bronze');

  // Second call should hit sessionStorage cache (no extra /users/anydev request)
  const cached = await fetchUserDashboardData('anydev', {
    fetchImpl: mockFetch,
    proxyUrl: 'https://tracker.example.com/api/achievements',
    storage
  });
  assert.equal(cached.fromCache, true);
  assert.equal(profileCalls, 1);

  // forceRefresh bypasses cache
  const refreshed = await fetchUserDashboardData('anydev', {
    fetchImpl: mockFetch,
    proxyUrl: 'https://tracker.example.com/api/achievements',
    storage,
    forceRefresh: true
  });
  assert.equal(refreshed.fromCache, false);
  assert.equal(profileCalls, 2);

  writeDashboardCache('custom', { fetchedAt: new Date(0).toISOString(), profile: {} }, storage);
  assert.equal(readDashboardCache('custom', 60_000, storage), null);
});
