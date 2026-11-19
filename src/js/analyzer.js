/**
 * Analysis engine transforming raw GitHub REST API responses into
 * achievement progress, Quickdraw evidence, language stats, and next actions.
 */

import { ACHIEVEMENTS_CATALOG, computeTierProgress } from './achievements.js';

export const QUICKDRAW_WINDOW_MS = 5 * 60 * 1000;

/**
 * Finds issues or pull requests closed within 5 minutes of creation.
 * @param {Array<{ title?: string, html_url?: string, created_at?: string, closed_at?: string, pull_request?: object }>} closedItems
 */
export function detectQuickdrawMatches(closedItems = []) {
  const matches = [];
  for (const item of closedItems) {
    if (!item?.created_at || !item?.closed_at) continue;
    const createdMs = Date.parse(item.created_at);
    const closedMs = Date.parse(item.closed_at);
    if (!Number.isFinite(createdMs) || !Number.isFinite(closedMs)) continue;

    const deltaMs = closedMs - createdMs;
    if (deltaMs >= 0 && deltaMs <= QUICKDRAW_WINDOW_MS) {
      matches.push({
        title: item.title || 'Untitled',
        url: item.html_url || '',
        type: item.pull_request ? 'pr' : 'issue',
        secondsToClose: Math.round(deltaMs / 1000),
        createdAt: item.created_at,
        closedAt: item.closed_at
      });
    }
  }
  return matches.sort((a, b) => a.secondsToClose - b.secondsToClose);
}

/**
 * Returns top owned repositories sorted by stargazer count, then recency.
 * @param {Array<object>} repositories
 * @param {number} [limit=6]
 */
export function extractTopRepositories(repositories = [], limit = 6) {
  return [...repositories]
    .filter((repo) => repo && !repo.fork)
    .sort((a, b) => {
      const starDiff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
      if (starDiff !== 0) return starDiff;
      return Date.parse(b.updated_at || 0) - Date.parse(a.updated_at || 0);
    })
    .slice(0, limit)
    .map((repo) => ({
      name: repo.name,
      fullName: repo.full_name || repo.name,
      description: repo.description || '',
      stars: Number(repo.stargazers_count || 0),
      forks: Number(repo.forks_count || 0),
      language: repo.language || null,
      url: repo.html_url || '',
      hasDiscussions: Boolean(repo.has_discussions),
      updatedAt: repo.updated_at || null
    }));
}

/**
 * Counts primary programming languages across owned repositories.
 * @param {Array<object>} repositories
 * @param {number} [limit=5]
 */
export function extractPrimaryLanguages(repositories = [], limit = 5) {
  const counts = new Map();
  for (const repo of repositories) {
    if (!repo || repo.fork || !repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language))
    .slice(0, limit);
}

/**
 * Generates direct GitHub Discussions Q&A search URLs tailored to the user's languages.
 * @param {Array<{ language: string, count: number }>} languages
 */
export function buildGalaxyBrainSearchLinks(languages = []) {
  const targets = languages.length > 0
    ? languages.slice(0, 4).map((l) => l.language)
    : ['JavaScript', 'TypeScript', 'Python'];

  return targets.map((language) => ({
    language,
    url: `https://github.com/search?q=${encodeURIComponent(`is:open is:unanswered ${language}`)}&type=discussions`
  }));
}

/**
 * Produces prioritized next-step recommendations based on current progress.
 * @param {Array<{ id: string, name: string, category: string, progress: object }>} analyzedAchievements
 */
export function buildRecommendations(analyzedAchievements) {
  const recommendations = [];

  for (const item of analyzedAchievements) {
    if (item.progress.isMaxTier) continue;
    const priorityScore =
      item.id === 'quickdraw' && !item.progress.unlocked ? 100
        : item.id === 'pull-shark' ? 90 - Math.min(80, item.progress.remaining)
        : item.id === 'pair-extraordinaire' ? 75
        : item.id === 'galaxy-brain' ? 65
        : item.id === 'starstruck' ? 60
        : item.id === 'public-sponsor' ? 50
        : 40;

    recommendations.push({
      id: item.id,
      name: item.name,
      category: item.category,
      nextLabel: item.progress.nextLabel,
      remaining: item.progress.remaining,
      priorityScore
    });
  }

  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 4);
}

/**
 * Full dashboard analysis combining GitHub REST API data with optional manual inputs
 * (for metrics unavailable on unauthenticated public REST endpoints).
 * @param {object} rawData
 * @param {{ coAuthoredPullRequests?: number, acceptedAnswers?: number, sponsorships?: number, yoloUnlocked?: boolean }} [manualOverrides]
 */
export function analyzeDashboardData(rawData, manualOverrides = {}) {
  const profile = rawData?.profile || {};
  const repositories = Array.isArray(rawData?.repositories) ? rawData.repositories : [];
  const mergedPullRequests = Number(rawData?.mergedPullRequests || 0);
  const recentClosedItems = Array.isArray(rawData?.recentClosedItems) ? rawData.recentClosedItems : [];

  const nonForkRepos = repositories.filter((repo) => repo && !repo.fork);
  const totalStars = nonForkRepos.reduce((acc, repo) => acc + Number(repo.stargazers_count || 0), 0);
  const topRepositories = extractTopRepositories(repositories, 6);
  const topStarredRepo = topRepositories[0] || null;
  const maxRepoStars = topStarredRepo ? topStarredRepo.stars : 0;

  const quickdrawEvidence = detectQuickdrawMatches(recentClosedItems);
  const languages = extractPrimaryLanguages(repositories, 5);
  const galaxyBrainLinks = buildGalaxyBrainSearchLinks(languages);

  const metrics = {
    mergedPullRequests,
    maxRepoStars,
    totalStars,
    quickdrawMatches: quickdrawEvidence.length,
    coAuthoredPullRequests: Number(manualOverrides.coAuthoredPullRequests || 0),
    acceptedAnswers: Number(manualOverrides.acceptedAnswers || 0),
    sponsorships: Number(manualOverrides.sponsorships || 0),
    yoloUnlocked: manualOverrides.yoloUnlocked ?? mergedPullRequests > 0
  };

  const achievements = ACHIEVEMENTS_CATALOG.map((def) => {
    let rawValue = 0;
    let source = 'api';

    if (def.id === 'yolo') {
      rawValue = metrics.yoloUnlocked ? 1 : 0;
      source = manualOverrides.yoloUnlocked !== undefined ? 'manual' : 'inferred';
    } else if (def.trackableViaApi === 'manual') {
      rawValue = metrics[def.metricKey] || 0;
      source = 'manual';
    } else {
      rawValue = metrics[def.metricKey] || 0;
      source = 'api';
    }

    return {
      ...def,
      source,
      progress: computeTierProgress(def, rawValue)
    };
  });

  const unlockedCount = achievements.filter((a) => a.progress.unlocked).length;
  const recommendations = buildRecommendations(achievements);

  return {
    profile: {
      login: profile.login || '',
      name: profile.name || profile.login || '',
      avatarUrl: profile.avatar_url || '',
      bio: profile.bio || '',
      htmlUrl: profile.html_url || '',
      publicRepos: Number(profile.public_repos || repositories.length),
      followers: Number(profile.followers || 0),
      following: Number(profile.following || 0),
      createdAt: profile.created_at || null
    },
    metrics: {
      ...metrics,
      topStarredRepoName: topStarredRepo?.name || null
    },
    summary: {
      unlockedCount,
      totalActive: achievements.length,
      completionPercent: Math.round((unlockedCount / achievements.length) * 100)
    },
    achievements,
    quickdrawEvidence,
    topRepositories,
    languages,
    galaxyBrainLinks,
    recommendations,
    rateLimit: rawData?.rateLimit || null,
    fetchedAt: rawData?.fetchedAt || new Date().toISOString()
  };
}
