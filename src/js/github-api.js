/**
 * GitHub REST API v3 client for browser & Node environments.
 * Zero external dependencies — supports injectable fetch for deterministic tests.
 */

export const GITHUB_API_BASE = 'https://api.github.com';

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
 * Fetches all data required to render the GitHub Achievements dashboard.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function fetchUserDashboardData(username, options = {}) {
  const profileRes = await fetchUserProfile(username, options);
  const login = profileRes.data.login;

  const [reposRes, mergedPrsRes, closedItemsRes] = await Promise.all([
    fetchUserRepositories(login, options),
    fetchMergedPullRequestsCount(login, options),
    fetchRecentClosedItems(login, options)
  ]);

  return {
    profile: profileRes.data,
    repositories: reposRes.data,
    mergedPullRequests: mergedPrsRes.data.totalCount,
    sampleMergedPrs: mergedPrsRes.data.sampleItems,
    recentClosedItems: closedItemsRes.data,
    rateLimit: closedItemsRes.rateLimit || mergedPrsRes.rateLimit || reposRes.rateLimit || profileRes.rateLimit,
    fetchedAt: new Date().toISOString()
  };
}
