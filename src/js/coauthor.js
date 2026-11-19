/**
 * Pair Extraordinaire helper: resolves GitHub collaborator noreply emails via
 * the GitHub REST API and builds valid `Co-authored-by:` commit trailers.
 */

import { fetchUserProfile } from './github-api.js';

/**
 * Builds GitHub's standard privacy-preserving noreply email address.
 * @param {{ id: number | string, login: string }} user
 */
export function buildGitHubNoReplyEmail(user) {
  if (!user?.id || !user?.login) {
    throw new Error('Both user id and login are required to build a GitHub noreply email.');
  }
  return `${user.id}+${user.login}@users.noreply.github.com`;
}

/**
 * Formats a single `Co-authored-by:` trailer line.
 * @param {{ name?: string, login?: string, email: string }} collaborator
 */
export function formatCoAuthorTrailer(collaborator) {
  const displayName = String(collaborator?.name || collaborator?.login || '').trim();
  const email = String(collaborator?.email || '').trim();
  if (!displayName || !email) {
    throw new Error('Collaborator name and email are required.');
  }
  return `Co-authored-by: ${displayName} <${email}>`;
}

/**
 * Resolves a GitHub username to a ready-to-use co-author descriptor via REST API.
 * @param {string} username
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function resolveCollaborator(username, options = {}) {
  const { data: user, rateLimit } = await fetchUserProfile(username, options);
  const email = buildGitHubNoReplyEmail(user);
  const displayName = (user.name || user.login).trim();
  return {
    id: user.id,
    login: user.login,
    name: displayName,
    avatarUrl: user.avatar_url || '',
    email,
    trailer: formatCoAuthorTrailer({ name: displayName, email }),
    rateLimit
  };
}

/**
 * Builds a complete multi-line commit message and copy-ready git CLI command.
 * @param {string} commitSummary
 * @param {Array<{ name?: string, login?: string, email: string }>} collaborators
 */
export function buildCoAuthoredCommit(commitSummary, collaborators = []) {
  const summary = String(commitSummary || 'feat: pair programming update').trim();
  const trailers = collaborators.map((c) => formatCoAuthorTrailer(c));
  const fullMessage = trailers.length > 0
    ? `${summary}\n\n${trailers.join('\n')}`
    : summary;

  const escapedSummary = summary.replaceAll('"', '\\"');
  const escapedTrailers = trailers.join('\n').replaceAll('"', '\\"');
  const gitCommand = trailers.length > 0
    ? `git commit -m "${escapedSummary}" -m "${escapedTrailers}"`
    : `git commit -m "${escapedSummary}"`;

  return {
    summary,
    trailers,
    fullMessage,
    gitCommand
  };
}
