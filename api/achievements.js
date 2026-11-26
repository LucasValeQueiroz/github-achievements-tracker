/**
 * Zero-dependency serverless endpoint (`/api/achievements?user=<login>`)
 * that automatically resolves live GitHub Achievements for ANY user
 * without requiring visitors to enter a Personal Access Token.
 *
 * Strategy:
 * 1. Fetches `https://github.com/{login}?tab=achievements` server-side (no CORS block)
 *    to read official public achievement badges and tiers (x2/x3/x4).
 * 2. When `process.env.GITHUB_TOKEN` is configured, also queries GitHub GraphQL
 *    (`acceptedAnswers`, `sponsorships`, `mergedPullRequests`, `maxRepoStars`) and
 *    authenticated REST Search (`coAuthoredCommits`, `yoloUnreviewedPrs`) using the
 *    server's 5,000 req/hr quota.
 */

export const BADGE_NAME_TO_ID = {
  'pull shark': 'pull-shark',
  starstruck: 'starstruck',
  quickdraw: 'quickdraw',
  yolo: 'yolo',
  'pair extraordinaire': 'pair-extraordinaire',
  'galaxy brain': 'galaxy-brain',
  'public sponsor': 'public-sponsor'
};

export const BADGE_TIER_THRESHOLDS = {
  'pull-shark': { default: 2, bronze: 16, silver: 128, gold: 1024 },
  starstruck: { default: 16, bronze: 128, silver: 512, gold: 4096 },
  quickdraw: { default: 1 },
  yolo: { default: 1 },
  'pair-extraordinaire': { default: 1, bronze: 10, silver: 24, gold: 48 },
  'galaxy-brain': { default: 2, bronze: 8, silver: 16, gold: 32 },
  'public-sponsor': { default: 1 }
};

/**
 * Converts a GitHub tier multiplier (`x2`, `x3`, `x4`) or CSS modifier class
 * into a canonical tier name.
 * @param {string} raw
 */
export function normalizeTier(raw = '') {
  const value = String(raw || '').toLowerCase();
  if (value.includes('gold') || value.includes('x4')) return 'gold';
  if (value.includes('silver') || value.includes('x3')) return 'silver';
  if (value.includes('bronze') || value.includes('x2')) return 'bronze';
  return 'default';
}

const TIER_RANK = { default: 1, bronze: 2, silver: 3, gold: 4 };

/**
 * Parses official GitHub profile achievements HTML (`?tab=achievements`) into
 * a deduplicated map of `{ [achievementId]: tier }`.
 * @param {string} html
 */
export function parseAchievementsHtml(html = '') {
  const badges = {};
  const source = String(html || '');
  const imgRegex = /alt="Achievement:\s*([^"]+)"/gi;
  let match;

  while ((match = imgRegex.exec(source)) !== null) {
    const rawName = match[1].trim().toLowerCase();
    const id = BADGE_NAME_TO_ID[rawName];
    if (!id) continue;

    // Look ahead within the same badge container up to the next achievement badge (max 500 chars).
    const afterStart = match.index + match[0].length;
    const nextBadgeIdx = source.indexOf('alt="Achievement:', afterStart);
    const maxEnd = Math.min(
      match.index + 500,
      nextBadgeIdx === -1 ? source.length : nextBadgeIdx
    );
    const windowSlice = source.slice(match.index, maxEnd);
    const tierMatch = windowSlice.match(
      /achievement-tier-label(?:--([a-z]+))?[^>]*>\s*(x[234])?/i
    );
    const detectedTier = tierMatch
      ? normalizeTier(`${tierMatch[1] || ''} ${tierMatch[2] || ''}`)
      : 'default';

    const prevTier = badges[id];
    if (!prevTier || TIER_RANK[detectedTier] > TIER_RANK[prevTier]) {
      badges[id] = detectedTier;
    }
  }

  return badges;
}

/**
 * Maps parsed official GitHub badge tiers into minimum verified numeric metrics
 * so the dashboard unlocks exact tiers automatically even without GraphQL auth.
 * @param {Record<string, string>} badges
 */
export function mapBadgeTiersToMetrics(badges = {}) {
  const thresholdFor = (id) => {
    const tier = badges?.[id];
    if (!tier) return 0;
    const map = BADGE_TIER_THRESHOLDS[id] || {};
    return map[tier] ?? map.default ?? 1;
  };

  return {
    acceptedAnswers: thresholdFor('galaxy-brain'),
    sponsorships: thresholdFor('public-sponsor'),
    coAuthoredCommits: thresholdFor('pair-extraordinaire'),
    yoloUnreviewedPrs: thresholdFor('yolo'),
    quickdrawUnlocked: Boolean(badges?.quickdraw),
    mergedPullRequestsFloor: thresholdFor('pull-shark'),
    maxRepoStarsFloor: thresholdFor('starstruck')
  };
}

/**
 * Queries GitHub GraphQL API when a server-side GITHUB_TOKEN is available.
 * @param {string} login
 * @param {string} token
 * @param {typeof fetch} [fetchImpl]
 */
export async function queryGraphqlWithServerToken(login, token, fetchImpl = globalThis.fetch) {
  if (!token || typeof fetchImpl !== 'function') return null;

  const query = `query($login: String!) {
    user(login: $login) {
      login
      name
      repositoryDiscussionComments(onlyAnswers: true) { totalCount }
      sponsoring { totalCount }
      pullRequests(states: MERGED) { totalCount }
      repositories(ownerAffiliations: OWNER, isFork: false, first: 1, orderBy: {field: STARGAZERS, direction: DESC}) {
        nodes { stargazerCount }
      }
    }
  }`;

  const response = await fetchImpl('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'github-achievements-tracker'
    },
    body: JSON.stringify({ query, variables: { login } })
  });

  if (!response.ok) return null;
  const payload = await response.json();
  const user = payload?.data?.user;
  if (!user) return null;

  const topRepoStars = Number(user.repositories?.nodes?.[0]?.stargazerCount ?? 0);

  return {
    login: user.login,
    name: user.name || user.login,
    acceptedAnswers: Number(user.repositoryDiscussionComments?.totalCount ?? 0),
    sponsorships: Number(user.sponsoring?.totalCount ?? 0),
    mergedPullRequests: Number(user.pullRequests?.totalCount ?? 0),
    maxRepoStars: topRepoStars
  };
}

/**
 * Queries authenticated REST Search for co-authored commits and unreviewed merged PRs
 * using the server's GITHUB_TOKEN so visitors never hit the 10 req/min browser limit.
 * @param {string} login
 * @param {string} token
 * @param {typeof fetch} [fetchImpl]
 */
export async function queryServerSearchMetrics(login, token, fetchImpl = globalThis.fetch) {
  if (!token || typeof fetchImpl !== 'function') return null;

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'github-achievements-tracker'
  };

  const coAuthorQuery = encodeURIComponent(`author:${login} Co-authored-by`);
  const yoloQuery = encodeURIComponent(`author:${login} type:pr is:merged review:none`);

  const [coAuthorRes, yoloRes] = await Promise.all([
    fetchImpl(`https://api.github.com/search/commits?q=${coAuthorQuery}&per_page=1`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetchImpl(`https://api.github.com/search/issues?q=${yoloQuery}&per_page=1`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  ]);

  if (!coAuthorRes && !yoloRes) return null;

  return {
    coAuthoredCommits: Number(coAuthorRes?.total_count ?? 0),
    yoloUnreviewedPrs: Number(yoloRes?.total_count ?? 0)
  };
}

/**
 * Fetches live achievements for any GitHub username combining the public
 * `?tab=achievements` page, GraphQL metrics, and server-side REST Search.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function resolveLiveUserAchievements(username, options = {}) {
  const { token = '', fetchImpl = globalThis.fetch } = options;
  const cleanUser = String(username || '').trim();
  if (!cleanUser || !/^[a-zA-Z0-9-]{1,39}$/.test(cleanUser)) {
    throw new Error('Invalid GitHub username.');
  }

  const [htmlRes, graphqlData, searchData] = await Promise.all([
    fetchImpl(`https://github.com/${encodeURIComponent(cleanUser)}?tab=achievements`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'github-achievements-tracker'
      }
    }).catch(() => null),
    queryGraphqlWithServerToken(cleanUser, token, fetchImpl).catch(() => null),
    queryServerSearchMetrics(cleanUser, token, fetchImpl).catch(() => null)
  ]);

  let badges = {};
  if (htmlRes && htmlRes.ok) {
    const html = await htmlRes.text();
    badges = parseAchievementsHtml(html);
  } else if (htmlRes && htmlRes.status === 404 && !graphqlData) {
    const err = new Error('GitHub user not found.');
    err.status = 404;
    throw err;
  }

  const badgeMetrics = mapBadgeTiersToMetrics(badges);

  return {
    login: graphqlData?.login || cleanUser,
    name: graphqlData?.name || cleanUser,
    acceptedAnswers: Math.max(graphqlData?.acceptedAnswers ?? 0, badgeMetrics.acceptedAnswers),
    sponsorships: Math.max(graphqlData?.sponsorships ?? 0, badgeMetrics.sponsorships),
    mergedPullRequests: Math.max(
      graphqlData?.mergedPullRequests ?? 0,
      badgeMetrics.mergedPullRequestsFloor
    ),
    maxRepoStars: Math.max(graphqlData?.maxRepoStars ?? 0, badgeMetrics.maxRepoStarsFloor),
    yoloUnreviewedPrs: Math.max(searchData?.yoloUnreviewedPrs ?? 0, badgeMetrics.yoloUnreviewedPrs),
    coAuthoredCommits: Math.max(searchData?.coAuthoredCommits ?? 0, badgeMetrics.coAuthoredCommits),
    quickdrawUnlocked: badgeMetrics.quickdrawUnlocked,
    badges,
    source: graphqlData ? 'graphql+badges' : 'badges',
    updatedAt: new Date().toISOString()
  };
}

/**
 * Vercel / Node HTTP Serverless Handler.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const rawUser = req.query?.user || new URL(req.url, 'https://localhost').searchParams.get('user');
  if (!rawUser) {
    res.status(400).json({ error: 'Missing required query parameter: user' });
    return;
  }

  try {
    const result = await resolveLiveUserAchievements(rawUser, {
      token: process.env.GITHUB_TOKEN || ''
    });
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(result);
  } catch (err) {
    const status = err?.status === 404 ? 404 : 400;
    res.status(status).json({ error: err?.message || 'Unable to resolve achievements.' });
  }
}
