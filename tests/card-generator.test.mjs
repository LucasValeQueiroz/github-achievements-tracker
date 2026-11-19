import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeXml,
  truncateText,
  getInitials,
  buildProfileCardSvg
} from '../src/js/card-generator.js';
import { analyzeDashboardData } from '../src/js/analyzer.js';

test('escapeXml and helpers safely handle XML entities and initials', () => {
  assert.equal(escapeXml('<Dev & "Co">'), '&lt;Dev &amp; &quot;Co&quot;&gt;');
  assert.equal(truncateText('Short', 10), 'Short');
  assert.equal(truncateText('A very long biography string', 10), 'A very lo…');
  assert.equal(getInitials('Lucas Vale Queiroz', 'LucasValeQueiroz'), 'LQ');
  assert.equal(getInitials('', 'octocat'), 'OC');
});

test('buildProfileCardSvg produces valid 1200x630 dark and light cards with escaped content', () => {
  const analysis = analyzeDashboardData({
    profile: {
      login: 'LucasValeQueiroz',
      name: 'Lucas <Vale>',
      bio: 'Backend & DevOps'
    },
    repositories: [
      { name: 'tracker', fork: false, stargazers_count: 20, language: 'JavaScript' }
    ],
    mergedPullRequests: 19,
    recentClosedItems: [
      { created_at: '2026-11-19T00:00:00Z', closed_at: '2026-11-19T00:00:05Z' }
    ]
  });

  const darkSvg = buildProfileCardSvg(analysis, { theme: 'dark', lang: 'pt' });
  assert.ok(darkSvg.startsWith('<?xml version="1.0"'));
  assert.ok(darkSvg.includes('width="1200" height="630"'));
  assert.ok(darkSvg.includes('Lucas &lt;Vale&gt;'));
  assert.ok(darkSvg.includes('Backend &amp; DevOps'));
  assert.ok(darkSvg.includes('Bronze'));
  assert.ok(darkSvg.includes('Progresso de Conquistas'));

  const lightSvg = buildProfileCardSvg(analysis, { theme: 'light', lang: 'en' });
  assert.ok(lightSvg.includes('#f6f8fa'));
  assert.ok(lightSvg.includes('Achievements Progress'));
});
