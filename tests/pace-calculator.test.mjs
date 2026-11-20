import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PULL_SHARK_MILESTONES,
  calculatePullSharkRoadmap,
  formatEstimatedDate,
} from '../src/js/pace-calculator.js';

test('calculatePullSharkRoadmap computes exact remaining counts and dates', () => {
  const ref = new Date(Date.UTC(2026, 10, 19)); // 2026-11-19
  const roadmap = calculatePullSharkRoadmap(25, 3, ref);

  assert.equal(roadmap.length, PULL_SHARK_MILESTONES.length);
  assert.equal(roadmap[0].reached, true);
  assert.equal(roadmap[1].reached, true);
  assert.equal(roadmap[1].daysNeeded, 0);

  // Silver: 128 - 25 = 103 PRs => ceil(103 / 3) = 35 days => 2026-12-24
  assert.equal(roadmap[2].key, 'silver');
  assert.equal(roadmap[2].remaining, 103);
  assert.equal(roadmap[2].daysNeeded, 35);
  assert.equal(roadmap[2].estimatedDateIso, '2026-12-24');

  // Gold: 1024 - 25 = 999 PRs => ceil(999 / 3) = 333 days
  assert.equal(roadmap[3].key, 'gold');
  assert.equal(roadmap[3].remaining, 999);
  assert.equal(roadmap[3].daysNeeded, 333);
});

test('calculatePullSharkRoadmap clamps invalid inputs safely', () => {
  const ref = new Date(Date.UTC(2026, 0, 1));
  const roadmap = calculatePullSharkRoadmap(-10, 0, ref);
  assert.equal(roadmap[0].remaining, 2);
  assert.equal(roadmap[0].daysNeeded, 2);
  assert.equal(roadmap[0].estimatedDateIso, '2026-01-03');
});

test('formatEstimatedDate formats ISO dates in PT-BR and EN', () => {
  const pt = formatEstimatedDate('2026-12-24', 'pt');
  const en = formatEstimatedDate('2026-12-24', 'en');
  assert.match(pt, /2026/);
  assert.match(en, /Dec.*24.*2026/);
});
