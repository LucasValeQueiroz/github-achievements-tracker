/**
 * Generates clean, human-readable social share posts (LinkedIn / X)
 * summarizing a GitHub user's live achievement progress and tracker link.
 */

export const TRACKER_BASE_URL = 'https://lucasvalequeiroz.github.io/github-achievements-tracker/';
export const X_CHAR_LIMIT = 280;

/**
 * Builds the direct shareable tracker URL for a given GitHub username.
 * @param {string} login
 * @param {string} [baseUrl]
 */
export function buildTrackerShareUrl(login, baseUrl = TRACKER_BASE_URL) {
  const cleanLogin = String(login || '').trim();
  const normalizedBase = String(baseUrl || TRACKER_BASE_URL).split('?')[0];
  if (!cleanLogin) return normalizedBase;
  return `${normalizedBase}?user=${encodeURIComponent(cleanLogin)}`;
}

/**
 * Builds a concise, natural social post for LinkedIn or X in PT-BR or EN.
 * @param {object} analysis - Output of analyzeDashboardData()
 * @param {{ platform?: 'linkedin'|'x', lang?: 'pt'|'en', baseUrl?: string }} [options]
 */
export function buildSocialSharePost(analysis, options = {}) {
  const platform = options.platform === 'x' ? 'x' : 'linkedin';
  const lang = options.lang === 'en' ? 'en' : 'pt';
  const profile = analysis?.profile || {};
  const metrics = analysis?.metrics || {};
  const summary = analysis?.summary || {};
  const achievements = Array.isArray(analysis?.achievements) ? analysis.achievements : [];

  const login = profile.login || 'octocat';
  const shareUrl = buildTrackerShareUrl(login, options.baseUrl);
  const mergedPrs = Number(metrics.mergedPullRequests || 0);
  const totalStars = Number(metrics.totalStars || 0);
  const unlockedCount = Number(summary.unlockedCount || 0);
  const totalActive = Number(summary.totalActive || achievements.length || 7);

  const unlockedNames = achievements
    .filter((item) => item?.progress?.unlocked)
    .map((item) => `${item.emoji || '🏆'} ${item.name}${item.progress?.currentTier?.label ? ` (${item.progress.currentTier.label})` : ''}`);

  if (platform === 'x') {
    const baseText =
      lang === 'en'
        ? `My @github progress (@${login}): ${unlockedCount}/${totalActive} achievements, ${mergedPrs} merged PRs${totalStars > 0 ? `, ${totalStars}★` : ''}. Check yours: ${shareUrl}`
        : `Meu progresso no @github (@${login}): ${unlockedCount}/${totalActive} conquistas, ${mergedPrs} PRs mergeados${totalStars > 0 ? `, ${totalStars}★` : ''}. Veja o seu: ${shareUrl}`;

    if (baseText.length <= X_CHAR_LIMIT) return baseText;
    return `${baseText.slice(0, X_CHAR_LIMIT - 1)}…`;
  }

  const badgesLine =
    unlockedNames.length > 0
      ? unlockedNames.join(' · ')
      : lang === 'en'
        ? 'Getting started on open-source milestones!'
        : 'Começando a jornada de conquistas open-source!';

  if (lang === 'en') {
    return [
      `Checked my GitHub Achievements progress (@${login}) using the open-source GitHub Achievements Tracker:`,
      '',
      `• Active Achievements: ${unlockedCount}/${totalActive}`,
      `• Merged Public PRs: ${mergedPrs}`,
      ...(totalStars > 0 ? [`• Total Stars: ${totalStars}★`] : []),
      `• Unlocked: ${badgesLine}`,
      '',
      `Inspect your own GitHub profile (100% client-side): ${shareUrl}`,
      '#GitHub #OpenSource #SoftwareEngineering',
    ].join('\n');
  }

  return [
    `Acompanhei meu progresso real nas conquistas do GitHub (@${login}) usando o GitHub Achievements Tracker (open-source):`,
    '',
    `• Conquistas Ativas: ${unlockedCount}/${totalActive}`,
    `• PRs Públicos Mergeados: ${mergedPrs}`,
    ...(totalStars > 0 ? [`• Total de Estrelas: ${totalStars}★`] : []),
    `• Desbloqueadas: ${badgesLine}`,
    '',
    `Teste com o seu perfil do GitHub (100% client-side): ${shareUrl}`,
    '#GitHub #OpenSource #EngenhariaDeSoftware',
  ].join('\n');
}

/**
 * Builds an official web share intent URL for X or LinkedIn.
 * @param {'linkedin'|'x'} platform
 * @param {string} text
 * @param {string} shareUrl
 */
export function buildShareIntentUrl(platform, text, shareUrl) {
  if (platform === 'x') {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(String(text || ''))}`;
  }
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(String(shareUrl || TRACKER_BASE_URL))}`;
}
