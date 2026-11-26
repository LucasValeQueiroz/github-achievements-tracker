import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReadmeBadgeSvg, computeLiveBadgeSummary, escapeSvgText } from '../api/badge.js';
import { queryServerSearchMetrics, resolveLiveUserAchievements } from '../api/achievements.js';
import { buildLiveReadmeCardMarkdown } from '../src/js/exporter.js';

test('renderReadmeBadgeSvg generates valid dark and light 495x195 SVG cards with XML escaping', () => {
  const svgDark = renderReadmeBadgeSvg(
    {
      login: 'LucasValeQueiroz',
      mergedPullRequests: 116,
      acceptedAnswers: 14,
      coAuthoredCommits: 24,
      maxRepoStars: 20,
      yoloUnreviewedPrs: 5,
      quickdrawUnlocked: true,
      sponsorships: 0
    },
    { theme: 'dark', lang: 'pt' }
  );

  assert.ok(svgDark.startsWith('<svg '));
  assert.ok(svgDark.includes('width="495" height="195"'));
  assert.ok(svgDark.includes('@LucasValeQueiroz'));
  assert.ok(svgDark.includes('116'));
  assert.ok(svgDark.includes('14'));
  assert.ok(svgDark.includes('6/7 ativas'));
  assert.ok(svgDark.includes('github-achievement-tracker.vercel.app'));

  const svgLight = renderReadmeBadgeSvg(
    { login: 'dev<script>', mergedPullRequests: 2 },
    { theme: 'light', lang: 'en' }
  );
  assert.ok(svgLight.includes('fill="#ffffff"'));
  assert.ok(!svgLight.includes('<script>'));
  assert.equal(escapeSvgText('<a&b>'), '&lt;a&amp;b&gt;');
});

test('computeLiveBadgeSummary counts unlocked achievements accurately', () => {
  const summary = computeLiveBadgeSummary({
    mergedPullRequests: 16,
    maxRepoStars: 0,
    acceptedAnswers: 8,
    coAuthoredCommits: 10,
    yoloUnreviewedPrs: 1,
    quickdrawUnlocked: true,
    sponsorships: 1
  });
  assert.equal(summary.unlockedCount, 6);
  assert.equal(summary.totalActive, 7);
});

test('queryServerSearchMetrics and resolveLiveUserAchievements enrich Pair Extraordinaire and YOLO via server token', async () => {
  const mockFetch = async (url) => {
    if (url.includes('tab=achievements')) {
      return { ok: true, status: 200, text: async () => '<img alt="Achievement: Quickdraw" />' };
    }
    if (url.includes('/graphql')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            user: {
              login: 'LucasValeQueiroz',
              name: 'Lucas Vale',
              repositoryDiscussionComments: { totalCount: 14 },
              sponsoring: { totalCount: 0 },
              pullRequests: { totalCount: 116 },
              repositories: { nodes: [{ stargazerCount: 3 }] }
            }
          }
        })
      };
    }
    if (url.includes('/search/commits')) {
      return { ok: true, status: 200, json: async () => ({ total_count: 25 }) };
    }
    if (url.includes('/search/issues')) {
      return { ok: true, status: 200, json: async () => ({ total_count: 90 }) };
    }
    return { ok: false, status: 404 };
  };

  const search = await queryServerSearchMetrics('LucasValeQueiroz', 'ghp_test', mockFetch);
  assert.equal(search.coAuthoredCommits, 25);
  assert.equal(search.yoloUnreviewedPrs, 90);

  const live = await resolveLiveUserAchievements('LucasValeQueiroz', {
    token: 'ghp_test',
    fetchImpl: mockFetch
  });
  assert.equal(live.mergedPullRequests, 116);
  assert.equal(live.acceptedAnswers, 14);
  assert.equal(live.coAuthoredCommits, 25);
  assert.equal(live.yoloUnreviewedPrs, 90);
  assert.equal(live.maxRepoStars, 3);
  assert.equal(live.quickdrawUnlocked, true);
});

test('buildLiveReadmeCardMarkdown builds clickable Vercel live SVG embed', () => {
  const md = buildLiveReadmeCardMarkdown('LucasValeQueiroz', { theme: 'dark', lang: 'pt' });
  assert.equal(
    md,
    '[![GitHub Achievements — @LucasValeQueiroz](https://github-achievement-tracker.vercel.app/api/badge?user=LucasValeQueiroz&theme=dark&lang=pt)](https://github-achievement-tracker.vercel.app/?user=LucasValeQueiroz)'
  );
});
