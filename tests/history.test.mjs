import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SNAPSHOTS,
  buildSnapshot,
  computeSnapshotDelta,
  loadProfileHistory,
  recordProfileSnapshot,
  clearProfileHistory,
} from '../src/js/history.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function makeAnalysis(overrides = {}) {
  return {
    profile: { login: overrides.login || 'LucasValeQueiroz' },
    metrics: {
      mergedPullRequests: overrides.prs ?? 25,
      maxRepoStars: overrides.maxStars ?? 0,
      totalStars: overrides.totalStars ?? 0,
    },
    summary: { unlockedCount: overrides.unlocked ?? 3 },
    fetchedAt: overrides.fetchedAt || '2026-11-19T18:00:00.000Z',
  };
}

test('buildSnapshot and computeSnapshotDelta calculate positive and zero deltas', () => {
  const prev = buildSnapshot(makeAnalysis({ prs: 20, maxStars: 2, totalStars: 5, unlocked: 3 }));
  const curr = buildSnapshot(makeAnalysis({ prs: 27, maxStars: 5, totalStars: 9, unlocked: 4 }));
  const delta = computeSnapshotDelta(curr, prev);

  assert.deepEqual(delta, {
    mergedPullRequests: 7,
    maxRepoStars: 3,
    totalStars: 4,
    unlockedCount: 1,
    hasChanges: true,
  });
  assert.equal(computeSnapshotDelta(curr, null), null);
});

test('recordProfileSnapshot deduplicates unchanged same-day re-renders and tracks changes', () => {
  const storage = createMemoryStorage();

  const first = recordProfileSnapshot(makeAnalysis({ prs: 25, fetchedAt: '2026-11-19T18:00:00.000Z' }), storage);
  assert.equal(first.snapshots.length, 1);
  assert.equal(first.delta, null);

  // Same day, identical metrics (e.g. toggling theme/language) should not append duplicate
  const dup = recordProfileSnapshot(makeAnalysis({ prs: 25, fetchedAt: '2026-11-19T19:00:00.000Z' }), storage);
  assert.equal(dup.snapshots.length, 1);

  // Same day, metrics improved -> records new snapshot and exposes delta
  const second = recordProfileSnapshot(
    makeAnalysis({ prs: 28, totalStars: 2, maxStars: 2, fetchedAt: '2026-11-19T22:00:00.000Z' }),
    storage
  );
  assert.equal(second.snapshots.length, 2);
  assert.equal(second.delta.mergedPullRequests, 3);
  assert.equal(second.delta.totalStars, 2);

  clearProfileHistory('lucasvalequeiroz', storage);
  assert.deepEqual(loadProfileHistory('LucasValeQueiroz', storage), []);
});

test('recordProfileSnapshot enforces MAX_SNAPSHOTS retention cap', () => {
  const storage = createMemoryStorage();
  for (let i = 1; i <= MAX_SNAPSHOTS + 5; i++) {
    recordProfileSnapshot(makeAnalysis({ prs: i }), storage);
  }
  const saved = loadProfileHistory('LucasValeQueiroz', storage);
  assert.equal(saved.length, MAX_SNAPSHOTS);
  assert.equal(saved[0].mergedPullRequests, 6);
  assert.equal(saved[saved.length - 1].mergedPullRequests, MAX_SNAPSHOTS + 5);
});
