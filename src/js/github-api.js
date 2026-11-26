/**
 * GitHub REST API v3, GraphQL & live proxy client for browser & Node environments.
 * Zero external dependencies — supports injectable fetch for deterministic tests.
 */

export const GITHUB_API_BASE = 'https://api.github.com';
export const DEFAULT_CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE_KEY_PREFIX = 'gat_dashboard_cache_v2:';

let cachedRuntimeConfig = null;

export class GitHubApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status: number, code: string, rateLimit?: object }} meta
   */
  constructor(message, { status, code, rateLimit = null }) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.code = code;
    this.rateLimit = rateLimit;
  }
}

/**
 * Builds standard GitHub REST API headers.
 * @param {string} [token]
 */
export function buildHeaders(token = '') {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const trimmed = String(token || '').trim();
  if (trimmed) {
    headers.Authorization = `Bearer ${trimmed}`;
  }
  return headers;
}

/**
 * Extracts rate limit headers when present.
 * @param {Headers | Record<string, string>} headers
 */
export function extractRateLimit(headers) {
  if (!headers) return null;
  const get = (key) =>
    typeof headers.get === 'function' ? headers.get(key) : headers[key] ?? headers[key.toLowerCase()];

  const limit = Number(get('x-ratelimit-limit'));
  const remaining = Number(get('x-ratelimit-remaining'));
  const reset = Number(get('x-ratelimit-reset'));

  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) {
    return null;
  }

  return {
    limit,
    remaining,
    resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null
  };
}

/**
 * Reads a cached dashboard payload from sessionStorage if still fresh.
 * @param {string} username
 * @param {number} [ttlMs]
 * @param {Storage} [storage]
 */
export function readDashboardCache(
  username,
  ttlMs = DEFAULT_CACHE_TTL_MS,
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null
) {
  if (!storage) return null;
  const key = `${CACHE_KEY_PREFIX}${String(username || '').trim().toLowerCase()}`;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt || !parsed?.data) return null;
    const ageMs = Date.now() - Date.parse(parsed.fetchedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > ttlMs) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Writes a dashboard payload into sessionStorage.
 * @param {string} username
 * @param {object} data
 * @param {Storage} [storage]
 */
export function writeDashboardCache(
  username,
  data,
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null
) {
  if (!storage || !data) return;
  const key = `${CACHE_KEY_PREFIX}${String(username || '').trim().toLowerCase()}`;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        data
      })
    );
  } catch {
    // Ignore storage quota / private-mode errors
  }
}

/**
 * Executes a GET request against the GitHub REST API.
 * @param {string} path
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function githubRequest(path, options = {}) {
  const { token = '', fetchImpl = globalThis.fetch } = options;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch implementation is not available in this runtime.');
  }

  const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: buildHeaders(token)
  });

  const rateLimit = extractRateLimit(response.headers);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubApiError(payload?.message || 'GitHub resource not found.', {
        status: 404,
        code: 'NOT_FOUND',
        rateLimit
      });
    }
    if (response.status === 403 || response.status === 429) {
      const isRateLimited =
        rateLimit?.remaining === 0 ||
        String(payload?.message || '').toLowerCase().includes('rate limit');
      throw new GitHubApiError(
        payload?.message || 'GitHub API rate limit exceeded.',
        {
          status: response.status,
          code: isRateLimited ? 'RATE_LIMITED' : 'FORBIDDEN',
          rateLimit
        }
      );
    }
    if (response.status === 401) {
      throw new GitHubApiError('Invalid or expired GitHub token.', {
        status: 401,
        code: 'UNAUTHORIZED',
        rateLimit
      });
    }
    throw new GitHubApiError(payload?.message || `GitHub API error (${response.status}).`, {
      status: response.status,
      code: 'API_ERROR',
      rateLimit
    });
  }

  return { data: payload, rateLimit };
}

/**
 * Fetches public profile metadata for a GitHub username.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchUserProfile(username, options = {}) {
  const cleanUser = encodeURIComponent(String(username || '').trim());
  if (!cleanUser) {
    throw new GitHubApiError('Username is required.', { status: 400, code: 'INVALID_INPUT' });
  }
  return githubRequest(`/users/${cleanUser}`, options);
}

/**
 * Fetches owned public repositories (up to 2 pages / 200 repos).
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchUserRepositories(username, options = {}) {
  const cleanUser = encodeURIComponent(String(username || '').trim());
  const firstPage = await githubRequest(
    `/users/${cleanUser}/repos?type=owner&per_page=100&sort=updated&page=1`,
    options
  );
  const repos = Array.isArray(firstPage.data) ? [...firstPage.data] : [];
  let rateLimit = firstPage.rateLimit;

  if (repos.length === 100) {
    const secondPage = await githubRequest(
      `/users/${cleanUser}/repos?type=owner&per_page=100&sort=updated&page=2`,
      options
    );
    if (Array.isArray(secondPage.data)) {
      repos.push(...secondPage.data);
    }
    rateLimit = secondPage.rateLimit || rateLimit;
  }

  return { data: repos, rateLimit };
}

/**
 * Queries the count of public merged pull requests authored by the user.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchMergedPullRequestsCount(username, options = {}) {
  const cleanUser = String(username || '').trim();
  const q = encodeURIComponent(`author:${cleanUser} type:pr is:merged`);
  const result = await githubRequest(`/search/issues?q=${q}&per_page=5`, options);
  return {
    data: {
      totalCount: Number(result.data?.total_count || 0),
      sampleItems: Array.isArray(result.data?.items) ? result.data.items : []
    },
    rateLimit: result.rateLimit
  };
}

/**
 * Fetches recently closed issues and pull requests authored by the user
 * to detect Quickdraw matches (closed within 5 minutes of creation).
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchRecentClosedItems(username, options = {}) {
  const cleanUser = String(username || '').trim();
  const q = encodeURIComponent(`author:${cleanUser} is:closed`);
  const result = await githubRequest(
    `/search/issues?q=${q}&sort=updated&order=desc&per_page=30`,
    options
  );
  return {
    data: Array.isArray(result.data?.items) ? result.data.items : [],
    rateLimit: result.rateLimit
  };
}

/**
 * Queries public merged PRs with zero reviews (direct YOLO achievement evidence).
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchYoloMergedPrsCount(username, options = {}) {
  const cleanUser = String(username || '').trim();
  const q = encodeURIComponent(`author:${cleanUser} type:pr is:merged review:none`);
  const result = await githubRequest(`/search/issues?q=${q}&per_page=1`, options);
  return {
    data: Number(result.data?.total_count || 0),
    rateLimit: result.rateLimit
  };
}

/**
 * Queries public commits authored by the user containing a Co-authored-by trailer.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchCoAuthoredCommitsCount(username, options = {}) {
  const cleanUser = String(username || '').trim();
  const q = encodeURIComponent(`author:${cleanUser} Co-authored-by`);
  const result = await githubRequest(`/search/commits?q=${q}&per_page=1`, options);
  return {
    data: Number(result.data?.total_count || 0),
    rateLimit: result.rateLimit
  };
}

/**
 * Fetches GraphQL-only achievement metrics (Galaxy Brain accepted answers + Public Sponsor count)
 * when an authenticated GitHub token is provided.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchGraphqlAchievementMetrics(username, options = {}) {
  const { token = '', fetchImpl = globalThis.fetch } = options;
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken || typeof fetchImpl !== 'function') {
    return null;
  }

  const query = `query($login: String!) {
    user(login: $login) {
      repositoryDiscussionComments(onlyAnswers: true) { totalCount }
      sponsoring { totalCount }
      pullRequests(states: MERGED) { totalCount }
    }
  }`;

  const response = await fetchImpl(`${GITHUB_API_BASE}/graphql`, {
    method: 'POST',
    headers: {
      ...buildHeaders(trimmedToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables: { login: String(username || '').trim() } })
  });

  if (!response.ok) return null;
  const payload = await response.json();
  const user = payload?.data?.user;
  if (!user) return null;

  return {
    acceptedAnswers: Number(user.repositoryDiscussionComments?.totalCount ?? 0),
    sponsorships: Number(user.sponsoring?.totalCount ?? 0),
    mergedPullRequests: Number(user.pullRequests?.totalCount ?? 0)
  };
}

/**
 * Loads optional runtime configuration from `data/config.json`.
 * @param {{ fetchImpl?: typeof fetch, force?: boolean }} [options]
 */
export async function fetchRuntimeConfig(options = {}) {
  const { fetchImpl = globalThis.fetch, force = false } = options;
  if (cachedRuntimeConfig && !force) return cachedRuntimeConfig;
  if (typeof fetchImpl !== 'function' || typeof window === 'undefined') {
    return { apiProxyUrl: '', autoRefreshMs: 300000 };
  }
  try {
    const res = await fetchImpl('./data/config.json', { cache: 'no-cache' });
    if (!res.ok) {
      cachedRuntimeConfig = { apiProxyUrl: '', autoRefreshMs: 300000 };
      return cachedRuntimeConfig;
    }
    const parsed = await res.json();
    cachedRuntimeConfig = {
      apiProxyUrl: String(parsed?.apiProxyUrl || '').trim(),
      autoRefreshMs: Number(parsed?.autoRefreshMs) > 0 ? Number(parsed.autoRefreshMs) : 300000
    };
    return cachedRuntimeConfig;
  } catch {
    cachedRuntimeConfig = { apiProxyUrl: '', autoRefreshMs: 300000 };
    return cachedRuntimeConfig;
  }
}

/**
 * Resolves the live achievements proxy URL if configured or hosted on a dynamic origin (e.g. Vercel).
 * @param {{ apiProxyUrl?: string }} [runtimeConfig]
 */
export function resolveAchievementsProxyUrl(runtimeConfig = {}) {
  const explicit = String(runtimeConfig?.apiProxyUrl || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location) {
    const host = String(window.location.hostname || '').toLowerCase();
    const protocol = String(window.location.protocol || '');
    if (protocol.startsWith('http') && !host.endsWith('.github.io')) {
      return '/api/achievements';
    }
  }
  return '';
}

/**
 * Calls the live `/api/achievements?user=<login>` proxy when available so EVERY visitor
 * gets automatic Galaxy Brain, Public Sponsor, and official badge tier detection without a token.
 * @param {string} username
 * @param {{ fetchImpl?: typeof fetch, proxyUrl?: string }} [options]
 */
export async function fetchLiveAchievementsProxy(username, options = {}) {
  const { fetchImpl = globalThis.fetch, proxyUrl: explicitProxyUrl } = options;
  if (typeof fetchImpl !== 'function') return null;

  let proxyUrl = explicitProxyUrl;
  if (proxyUrl === undefined) {
    const config = await fetchRuntimeConfig({ fetchImpl });
    proxyUrl = resolveAchievementsProxyUrl(config);
  }
  if (!proxyUrl) return null;

  const separator = proxyUrl.includes('?') ? '&' : '?';
  const url = `${proxyUrl}${separator}user=${encodeURIComponent(String(username || '').trim())}`;
  try {
    const res = await fetchImpl(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || data.error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Loads the GitHub-Actions-synced multi-user snapshot (`data/profiles-snapshot.json`)
 * and falls back to the legacy single-user snapshot (`data/profile-snapshot.json`).
 * @param {string} username
 * @param {{ fetchImpl?: typeof fetch, forceBrowserCheck?: boolean }} [options]
 */
export async function fetchLocalProfileSnapshot(username, options = {}) {
  const { fetchImpl = globalThis.fetch, forceBrowserCheck = true } = options;
  if (typeof fetchImpl !== 'function') return null;
  if (forceBrowserCheck && typeof window === 'undefined') return null;

  const targetKey = String(username || '').trim().toLowerCase();
  if (!targetKey) return null;

  try {
    const multiRes = await fetchImpl('./data/profiles-snapshot.json', { cache: 'no-cache' });
    if (multiRes.ok) {
      const multi = await multiRes.json();
      const hit = multi?.profiles?.[targetKey];
      if (hit && typeof hit === 'object') {
        return hit;
      }
    }
  } catch {
    // Fall through to legacy snapshot
  }

  try {
    const res = await fetchImpl('./data/profile-snapshot.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const snap = await res.json();
    if (String(snap?.login || '').toLowerCase() !== targetKey) {
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

/**
 * Fetches all data required to render the GitHub Achievements dashboard.
 * Uses short-lived sessionStorage caching unless `forceRefresh: true` is passed.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch, forceRefresh?: boolean, proxyUrl?: string, cacheTtlMs?: number, storage?: Storage }} [options]
 */
export async function fetchUserDashboardData(username, options = {}) {
  const {
    forceRefresh = false,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } = options;

  const cleanInput = String(username || '').trim();
  if (!forceRefresh && !options.token) {
    const cached = readDashboardCache(cleanInput, cacheTtlMs, storage);
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  const profileRes = await fetchUserProfile(cleanInput, options);
  const login = profileRes.data.login;

  const [
    reposRes,
    mergedPrsRes,
    closedItemsRes,
    yoloRes,
    coAuthorRes,
    graphqlMetrics,
    liveProxy,
    snapshot
  ] = await Promise.all([
    fetchUserRepositories(login, options),
    fetchMergedPullRequestsCount(login, options).catch(() => null),
    fetchRecentClosedItems(login, options).catch(() => null),
    fetchYoloMergedPrsCount(login, options).catch(() => null),
    fetchCoAuthoredCommitsCount(login, options).catch(() => null),
    fetchGraphqlAchievementMetrics(login, options).catch(() => null),
    fetchLiveAchievementsProxy(login, options).catch(() => null),
    fetchLocalProfileSnapshot(login, options).catch(() => null)
  ]);

  const autoMetrics = {};
  const autoSources = {};

  if (typeof yoloRes?.data === 'number') {
    autoMetrics.yoloUnreviewedPrs = yoloRes.data;
    autoSources.yolo = 'api';
  }
  if (typeof coAuthorRes?.data === 'number') {
    autoMetrics.coAuthoredPullRequests = coAuthorRes.data;
    autoSources.coAuthoredPullRequests = 'api';
  }

  // Priority order for GraphQL / badge-only metrics:
  // 1. Authenticated GraphQL API (user token)
  // 2. Live Serverless Proxy (/api/achievements) — works automatically for EVERY visitor
  // 3. GitHub-Actions-synced multi-user snapshot (data/profiles-snapshot.json)
  const fallbackSource = liveProxy || snapshot;

  if (graphqlMetrics) {
    autoMetrics.acceptedAnswers = graphqlMetrics.acceptedAnswers;
    autoMetrics.sponsorships = graphqlMetrics.sponsorships;
    autoSources.acceptedAnswers = 'api';
    autoSources.sponsorships = 'api';
  } else if (fallbackSource) {
    if (typeof fallbackSource.acceptedAnswers === 'number') {
      autoMetrics.acceptedAnswers = fallbackSource.acceptedAnswers;
      autoSources.acceptedAnswers = 'api';
    }
    if (typeof fallbackSource.sponsorships === 'number') {
      autoMetrics.sponsorships = fallbackSource.sponsorships;
      autoSources.sponsorships = 'api';
    }
    if (
      autoMetrics.coAuthoredPullRequests === undefined &&
      typeof fallbackSource.coAuthoredCommits === 'number'
    ) {
      autoMetrics.coAuthoredPullRequests = fallbackSource.coAuthoredCommits;
      autoSources.coAuthoredPullRequests = 'api';
    }
    if (
      autoMetrics.yoloUnreviewedPrs === undefined &&
      typeof fallbackSource.yoloUnreviewedPrs === 'number'
    ) {
      autoMetrics.yoloUnreviewedPrs = fallbackSource.yoloUnreviewedPrs;
      autoSources.yolo = 'api';
    }
  }

  if (liveProxy?.quickdrawUnlocked || snapshot?.quickdrawUnlocked) {
    autoMetrics.quickdrawUnlocked = true;
    autoSources.quickdraw = 'api';
  }

  const mergedPullRequests = Math.max(
    Number(graphqlMetrics?.mergedPullRequests ?? 0),
    Number(mergedPrsRes?.data?.totalCount ?? 0),
    Number(liveProxy?.mergedPullRequests ?? 0),
    Number(snapshot?.mergedPullRequests ?? 0)
  );

  const payload = {
    profile: profileRes.data,
    repositories: reposRes.data,
    mergedPullRequests,
    sampleMergedPrs: mergedPrsRes?.data?.sampleItems || [],
    recentClosedItems: closedItemsRes?.data || [],
    autoMetrics,
    autoSources,
    liveSyncSource: graphqlMetrics
      ? 'graphql'
      : liveProxy
        ? 'live-proxy'
        : snapshot
          ? 'snapshot'
          : 'rest',
    rateLimit:
      closedItemsRes?.rateLimit ||
      mergedPrsRes?.rateLimit ||
      reposRes.rateLimit ||
      profileRes.rateLimit,
    fetchedAt: new Date().toISOString(),
    fromCache: false
  };

  if (!options.token) {
    writeDashboardCache(login, payload, storage);
  }

  return payload;
}
