import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('Open Graph preview asset exists and is referenced with absolute HTTPS URLs', () => {
  assert.equal(existsSync('assets/og-preview.png'), true);

  const indexHtml = readFileSync('index.html', 'utf8');
  const docsHtml = readFileSync('docs.html', 'utf8');
  const expectedOgImage =
    'https://lucasvalequeiroz.github.io/github-achievements-tracker/assets/og-preview.png';

  for (const html of [indexHtml, docsHtml]) {
    assert.ok(html.includes(`property="og:image" content="${expectedOgImage}"`));
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  }
});
