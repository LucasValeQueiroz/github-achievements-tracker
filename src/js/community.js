/**
 * Open-source Community Database helpers:
 * loads `data/profiles-snapshot.json`, filters/sorts registered profiles,
 * and builds 1-click IssueOps registration URLs.
 */

export const REPO_ISSUES_NEW_URL =
  'https://github.com/LucasValeQueiroz/github-achievements-tracker/issues/new';

/**
 * Builds a pre-filled GitHub Issue URL that triggers `.github/workflows/register-user.yml`.
 * @param {string} [username]
 */
export function buildRegisterIssueUrl(username = '') {
  const clean = String(username || '').trim().replace(/^@/, '');
  const title = clean ? `[Register] ${clean}` : '[Register] seu-username';
  const body =
    'Cadastro automático na base open source do GitHub Achievements Tracker. Basta clicar em **Submit new issue**!';
  const params = new URLSearchParams({ title, body });
  return `${REPO_ISSUES_NEW_URL}?${params.toString()}`;
}

/**
 * Fetches all registered profiles from `data/profiles-snapshot.json`.
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function fetchCommunityProfiles(options = {}) {
  const { fetchImpl = globalThis.fetch } = options;
  if (typeof fetchImpl !== 'function') return [];
  try {
    const res = await fetchImpl('./data/profiles-snapshot.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const payload = await res.json();
    const map = payload?.profiles || {};
    return Object.values(map).filter((item) => item && item.login);
  } catch {
    return [];
  }
}

/**
 * Checks whether a username is already present in the community database.
 * @param {Array<{ login: string }>} profiles
 * @param {string} username
 */
export function isProfileRegistered(profiles = [], username = '') {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return false;
  return profiles.some((p) => String(p?.login || '').toLowerCase() === target);
}

/**
 * Filters and sorts community profiles by search query and chosen metric.
 * @param {Array<object>} profiles
 * @param {{ query?: string, sortBy?: 'mergedPullRequests' | 'acceptedAnswers' | 'coAuthoredCommits' }} [options]
 */
export function filterAndSortCommunity(profiles = [], options = {}) {
  const query = String(options.query || '').trim().toLowerCase().replace(/^@/, '');
  const sortBy = options.sortBy || 'mergedPullRequests';

  return [...profiles]
    .filter((p) => {
      if (!query) return true;
      return String(p?.login || '').toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const diff = Number(b?.[sortBy] || 0) - Number(a?.[sortBy] || 0);
      if (diff !== 0) return diff;
      return String(a?.login || '').localeCompare(String(b?.login || ''));
    });
}
