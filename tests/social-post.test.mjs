import test from 'node:test';
import assert from 'node:assert/strict';
import {
  X_CHAR_LIMIT,
  buildTrackerShareUrl,
  buildSocialSharePost,
  buildShareIntentUrl,
} from '../src/js/social-post.js';

const sampleAnalysis = {
  profile: { login: 'LucasValeQueiroz' },
  metrics: { mergedPullRequests: 106, totalStars: 0 },
  summary: { unlockedCount: 5, totalActive: 7 },
  achievements: [
    { name: 'Pull Shark', emoji: '🦈', progress: { unlocked: true, currentTier: { label: 'Bronze' } } },
    { name: 'Galaxy Brain', emoji: '🧠', progress: { unlocked: true, currentTier: { label: 'Default' } } },
    { name: 'Starstruck', emoji: '⭐', progress: { unlocked: false, currentTier: null } },
  ],
};

test('buildTrackerShareUrl encodes login cleanly and preserves base path', () => {
  assert.equal(
    buildTrackerShareUrl('LucasValeQueiroz', 'https://example.com/tracker/?old=1'),
    'https://example.com/tracker/?user=LucasValeQueiroz'
  );
  assert.equal(buildTrackerShareUrl(''), 'https://lucasvalequeiroz.github.io/github-achievements-tracker/');
});

test('buildSocialSharePost generates concise PT and EN LinkedIn posts without showing 0 stars', () => {
  const ptPost = buildSocialSharePost(sampleAnalysis, { platform: 'linkedin', lang: 'pt' });
  assert.match(ptPost, /@LucasValeQueiroz/);
  assert.match(ptPost, /5\/7/);
  assert.match(ptPost, /106/);
  assert.match(ptPost, /Pull Shark \(Bronze\)/);
  assert.doesNotMatch(ptPost, /Total de Estrelas: 0/);

  const enPost = buildSocialSharePost(sampleAnalysis, { platform: 'linkedin', lang: 'en' });
  assert.match(enPost, /Active Achievements: 5\/7/);
  assert.match(enPost, /Merged Public PRs: 106/);
  assert.doesNotMatch(enPost, /Total Stars: 0/);
});

test('buildSocialSharePost keeps X posts within 280 characters and includes star count when positive', () => {
  const starred = { ...sampleAnalysis, metrics: { mergedPullRequests: 106, totalStars: 42 } };
  const xPost = buildSocialSharePost(starred, { platform: 'x', lang: 'en' });
  assert.ok(xPost.length <= X_CHAR_LIMIT);
  assert.match(xPost, /42★/);
  assert.match(xPost, /\?user=LucasValeQueiroz/);
});

test('buildShareIntentUrl returns valid X and LinkedIn intent links', () => {
  const xIntent = buildShareIntentUrl('x', 'Hello world', 'https://example.com');
  assert.ok(xIntent.startsWith('https://twitter.com/intent/tweet?text='));

  const liIntent = buildShareIntentUrl('linkedin', 'Hello world', 'https://example.com/?user=dev');
  assert.ok(liIntent.startsWith('https://www.linkedin.com/sharing/share-offsite/?url='));
  assert.match(liIntent, /user%3Ddev/);
});
