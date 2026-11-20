import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GITHUB_APPEARANCE_URL,
  SKIN_TONE_OPTIONS,
  SKIN_TONE_AFFECTED_ACHIEVEMENTS,
  getSkinToneOption,
} from '../src/js/skin-tones.js';

test('SKIN_TONE_OPTIONS exposes all 6 GitHub emoji skin tone preferences', () => {
  assert.equal(SKIN_TONE_OPTIONS.length, 6);
  const ids = SKIN_TONE_OPTIONS.map((o) => o.id);
  assert.deepEqual(ids, ['default', 'light', 'medium-light', 'medium', 'medium-dark', 'dark']);
  assert.equal(GITHUB_APPEARANCE_URL, 'https://github.com/settings/appearance');
  assert.deepEqual(SKIN_TONE_AFFECTED_ACHIEVEMENTS, ['quickdraw', 'starstruck']);
});

test('getSkinToneOption resolves valid ids and falls back safely to default', () => {
  assert.equal(getSkinToneOption('medium').emoji, '👋🏽');
  assert.equal(getSkinToneOption('dark').labelEn, 'Dark');
  assert.equal(getSkinToneOption('unknown-id').id, 'default');
  assert.equal(getSkinToneOption(null).id, 'default');
});
