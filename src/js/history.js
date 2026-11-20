/**
 * Local progress snapshot history and delta calculator (localStorage-backed).
 */

export const HISTORY_STORAGE_PREFIX = 'gh-achievements-history:';
export const MAX_SNAPSHOTS = 20;

function normalizeKey(username) {
  return `${HISTORY_STORAGE_PREFIX}${String(username || '').trim().toLowerCase()}`;
}

/**
 * Extracts a compact, serializable metric snapshot from a full dashboard analysis.
 * @param {object} analysis
 */
export function buildSnapshot(analysis) {
  return {
    recordedAt: analysis?.fetchedAt || new Date().toISOString(),
    mergedPullRequests: Number(analysis?.metrics?.mergedPullRequests || 0),
    maxRepoStars: Number(analysis?.metrics?.maxRepoStars || 0),
    totalStars: Number(analysis?.metrics?.totalStars || 0),
    unlockedCount: Number(analysis?.summary?.unlockedCount || 0),
  };
}

/**
 * Computes numeric deltas between the latest snapshot and the previous one.
 * @param {object} current
 * @param {object|null} previous
 */
export function computeSnapshotDelta(current, previous) {
  if (!current || !previous) return null;
  const mergedPullRequests = current.mergedPullRequests - previous.mergedPullRequests;
  const maxRepoStars = current.maxRepoStars - previous.maxRepoStars;
  const totalStars = current.totalStars - previous.totalStars;
  const unlockedCount = current.unlockedCount - previous.unlockedCount;
  const hasChanges =
    mergedPullRequests !== 0 ||
    maxRepoStars !== 0 ||
    totalStars !== 0 ||
    unlockedCount !== 0;

  return {
    mergedPullRequests,
    maxRepoStars,
    totalStars,
    unlockedCount,
    hasChanges,
  };
}

/**
 * Loads saved snapshots for a given GitHub username.
 * @param {string} username
 * @param {Storage} [storage]
 */
export function loadProfileHistory(username, storage = globalThis.localStorage) {
  if (!username || !storage) return [];
  try {
    const raw = storage.getItem(normalizeKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Records a new snapshot when metrics or calendar day changed, keeping at most MAX_SNAPSHOTS.
 * Returns the full snapshot array, latest, previous, and computed delta.
 * @param {object} analysis
 * @param {Storage} [storage]
 */
export function recordProfileSnapshot(analysis, storage = globalThis.localStorage) {
  const username = analysis?.profile?.login;
  const current = buildSnapshot(analysis);
  if (!username || !storage) {
    return { snapshots: [current], latest: current, previous: null, delta: null };
  }

  const existing = loadProfileHistory(username, storage);
  const last = existing[existing.length - 1] || null;
  const sameDay = last && String(last.recordedAt).slice(0, 10) === String(current.recordedAt).slice(0, 10);
  const lastDelta = computeSnapshotDelta(current, last);

  let updated = existing;
  if (!last || !sameDay || lastDelta?.hasChanges) {
    updated = [...existing, current].slice(-MAX_SNAPSHOTS);
    try {
      storage.setItem(normalizeKey(username), JSON.stringify(updated));
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }

  const latest = updated[updated.length - 1] || current;
  const previous = updated.length >= 2 ? updated[updated.length - 2] : null;
  const delta = computeSnapshotDelta(latest, previous);

  return { snapshots: updated, latest, previous, delta };
}

/**
 * Clears all saved snapshots for a GitHub username.
 * @param {string} username
 * @param {Storage} [storage]
 */
export function clearProfileHistory(username, storage = globalThis.localStorage) {
  if (!username || !storage) return;
  try {
    storage.removeItem(normalizeKey(username));
  } catch {
    // Ignore storage errors
  }
}
