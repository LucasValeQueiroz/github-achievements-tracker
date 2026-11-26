#!/usr/bin/env node
/**
 * Syncs live achievement snapshots for all tracked GitHub profiles
 * (`data/tracked-users.json` + optional CLI username args) into:
 *   - `data/profiles-snapshot.json` (multi-user map keyed by lowercase login)
 *   - `data/profile-snapshot.json`  (primary profile backward-compatible snapshot)
 *
 * Uses `process.env.GITHUB_TOKEN` when available (provided automatically in GitHub Actions).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLiveUserAchievements } from '../api/achievements.js';
import {
  fetchYoloMergedPrsCount,
  fetchCoAuthoredCommitsCount
} from '../src/js/github-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TRACKED_USERS_PATH = path.join(ROOT_DIR, 'data', 'tracked-users.json');
const MULTI_SNAPSHOT_PATH = path.join(ROOT_DIR, 'data', 'profiles-snapshot.json');
const LEGACY_SNAPSHOT_PATH = path.join(ROOT_DIR, 'data', 'profile-snapshot.json');

const PRIMARY_LOGIN = 'LucasValeQueiroz';

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function syncSingleUser(username, token) {
  const live = await resolveLiveUserAchievements(username, { token });
  const [yoloRes, coAuthorRes] = await Promise.all([
    fetchYoloMergedPrsCount(live.login, { token }).catch(() => null),
    fetchCoAuthoredCommitsCount(live.login, { token }).catch(() => null)
  ]);

  return {
    login: live.login,
    acceptedAnswers: live.acceptedAnswers,
    sponsorships: live.sponsorships,
    mergedPullRequests: live.mergedPullRequests,
    yoloUnreviewedPrs: Math.max(live.yoloUnreviewedPrs, yoloRes?.data ?? 0),
    coAuthoredCommits: Math.max(live.coAuthoredCommits, coAuthorRes?.data ?? 0),
    quickdrawUnlocked: live.quickdrawUnlocked,
    badges: live.badges,
    updatedAt: live.updatedAt
  };
}

async function main() {
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const extraUsers = process.argv.slice(2).map((u) => u.trim()).filter(Boolean);

  const tracked = await readJsonSafe(TRACKED_USERS_PATH, [PRIMARY_LOGIN]);
  const seen = new Set();
  const users = [];

  for (const login of [...tracked, ...extraUsers]) {
    const clean = String(login || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    users.push(clean);
  }

  if (extraUsers.length > 0) {
    await fs.writeFile(TRACKED_USERS_PATH, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
  }

  const existingMulti = await readJsonSafe(MULTI_SNAPSHOT_PATH, { profiles: {} });
  const profiles = { ...(existingMulti?.profiles || {}) };

  for (const username of users) {
    try {
      const snap = await syncSingleUser(username, token);
      profiles[snap.login.toLowerCase()] = snap;
      console.log(`[sync] OK @${snap.login} (PRs=${snap.mergedPullRequests}, GalaxyBrain=${snap.acceptedAnswers}, Sponsor=${snap.sponsorships})`);
    } catch (err) {
      console.warn(`[sync] WARN @${username}: ${err.message}`);
    }
  }

  const multiPayload = {
    updatedAt: new Date().toISOString(),
    profiles
  };
  await fs.writeFile(MULTI_SNAPSHOT_PATH, `${JSON.stringify(multiPayload, null, 2)}\n`, 'utf8');

  const primary = profiles[PRIMARY_LOGIN.toLowerCase()];
  if (primary) {
    const legacyPayload = {
      login: primary.login,
      acceptedAnswers: primary.acceptedAnswers,
      sponsorships: primary.sponsorships,
      mergedPullRequests: primary.mergedPullRequests,
      yoloUnreviewedPrs: primary.yoloUnreviewedPrs,
      coAuthoredCommits: primary.coAuthoredCommits,
      updatedAt: primary.updatedAt
    };
    await fs.writeFile(LEGACY_SNAPSHOT_PATH, `${JSON.stringify(legacyPayload, null, 2)}\n`, 'utf8');
  }
}

main().catch((err) => {
  console.error('[sync] Fatal error:', err);
  process.exit(1);
});
