/**
 * Markdown badge & progress table exporter and JSON report serializer.
 */

const TIER_COLORS = {
  locked: '6e7681',
  default: '2f81f7',
  bronze: 'cd7f32',
  silver: 'a8b3be',
  gold: 'd4a017'
};

/**
 * Escapes text for Shields.io path segments.
 * @param {string} value
 */
export function escapeShieldText(value) {
  return encodeURIComponent(
    String(value || '')
      .replaceAll('-', '--')
      .replaceAll('_', '__')
      .replaceAll(' ', '_')
  );
}

/**
 * Builds a Shields.io markdown badge for an analyzed achievement.
 * @param {{ name: string, progress: { currentTier: string, currentLabel: string } }} achievement
 */
export function buildAchievementShield(achievement) {
  const tier = achievement?.progress?.currentTier || 'locked';
  const label = achievement?.progress?.currentLabel || 'Locked';
  const color = TIER_COLORS[tier] || TIER_COLORS.locked;
  const left = escapeShieldText(achievement.name);
  const right = escapeShieldText(label);
  return `![${achievement.name}: ${label}](https://img.shields.io/badge/${left}-${right}-${color}?style=for-the-badge&logo=github)`;
}

/**
 * Builds a Markdown snippet ready to paste into a GitHub Profile README.
 * @param {object} analysis
 * @param {'pt'|'en'} [lang='en']
 */
export function buildMarkdownReport(analysis, lang = 'en') {
  const isPt = lang === 'pt';
  const login = analysis?.profile?.login || 'user';
  const achievements = Array.isArray(analysis?.achievements) ? analysis.achievements : [];

  const title = isPt
    ? `## 🏆 Progresso de GitHub Achievements — @${login}`
    : `## 🏆 GitHub Achievements Progress — @${login}`;

  const badgesLine = achievements
    .filter((a) => a.progress.unlocked)
    .map((a) => buildAchievementShield(a))
    .join(' ');

  const header = isPt
    ? '| Conquista | Status / Nível | Progresso | Próxima meta |'
    : '| Achievement | Status / Tier | Progress | Next Milestone |';

  const rows = achievements.map((a) => {
    const p = a.progress;
    const status = p.unlocked ? `✅ ${p.currentLabel}` : (isPt ? '🔒 Bloqueado' : '🔒 Locked');
    const progressText = p.isMaxTier
      ? `${p.value} (MAX)`
      : `${p.value} / ${p.nextThreshold} (${p.percent}%)`;
    const nextText = p.isMaxTier
      ? (isPt ? 'Nível máximo atingido' : 'Max tier reached')
      : (isPt ? `${p.nextLabel} (faltam ${p.remaining})` : `${p.nextLabel} (${p.remaining} left)`);

    return `| ${a.emoji} **${a.name}** | ${status} | ${progressText} | ${nextText} |`;
  });

  const footer = isPt
    ? `_Gerado com [GitHub Achievements Tracker](https://lucasvalequeiroz.github.io/github-achievements-tracker/?user=${encodeURIComponent(login)})_`
    : `_Generated with [GitHub Achievements Tracker](https://lucasvalequeiroz.github.io/github-achievements-tracker/?user=${encodeURIComponent(login)})_`;

  const sections = [title];
  if (badgesLine) {
    sections.push('', badgesLine);
  }
  sections.push('', header, '| :--- | :--- | :--- | :--- |', ...rows, '', footer);
  return sections.join('\n');
}

/**
 * Serializes the dashboard analysis into a clean JSON string.
 * @param {object} analysis
 */
export function buildJsonReport(analysis) {
  return JSON.stringify(
    {
      schemaVersion: '1.0',
      generatedAt: analysis?.fetchedAt || new Date().toISOString(),
      profile: analysis?.profile || {},
      summary: analysis?.summary || {},
      metrics: analysis?.metrics || {},
      achievements: (analysis?.achievements || []).map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category,
        source: a.source,
        progress: a.progress
      })),
      topRepositories: analysis?.topRepositories || []
    },
    null,
    2
  );
}
