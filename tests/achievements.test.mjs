import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS_CATALOG,
  getAchievementById,
  computeTierProgress
} from '../src/js/achievements.js';

test('catalog defines all 7 active GitHub achievements', () => {
  assert.equal(ACHIEVEMENTS_CATALOG.length, 7);
  const ids = ACHIEVEMENTS_CATALOG.map((a) => a.id);
  assert.deepEqual(ids, [
    'pull-shark',
    'starstruck',
    'quickdraw',
    'yolo',
    'pair-extraordinaire',
    'galaxy-brain',
    'public-sponsor'
  ]);
});

test('computeTierProgress handles locked, intermediate, and max Pull Shark tiers', () => {
  const pullShark = getAchievementById('pull-shark');
  assert.ok(pullShark);

  const locked = computeTierProgress(pullShark, 1);
  assert.equal(locked.unlocked, false);
  assert.equal(locked.currentTier, 'locked');
  assert.equal(locked.nextTier, 'default');
  assert.equal(locked.remaining, 1);
  assert.equal(locked.percent, 50);

  const bronze = computeTierProgress(pullShark, 16);
  assert.equal(bronze.unlocked, true);
  assert.equal(bronze.currentTier, 'bronze');
  assert.equal(bronze.nextTier, 'silver');
  assert.equal(bronze.remaining, 112);
  assert.equal(bronze.percent, 0);

  const gold = computeTierProgress(pullShark, 2000);
  assert.equal(gold.unlocked, true);
  assert.equal(gold.currentTier, 'gold');
  assert.equal(gold.isMaxTier, true);
  assert.equal(gold.remaining, 0);
  assert.equal(gold.percent, 100);
});

test('computeTierProgress clamps negative and non-finite inputs to zero', () => {
  const quickdraw = getAchievementById('quickdraw');
  const neg = computeTierProgress(quickdraw, -5);
  assert.equal(neg.value, 0);
  assert.equal(neg.unlocked, false);

  const nan = computeTierProgress(quickdraw, Number.NaN);
  assert.equal(nan.value, 0);
  assert.equal(nan.unlocked, false);
});
