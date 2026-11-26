/**
 * Dynamic live SVG badge endpoint (`/api/badge?user=<login>&theme=dark|light&lang=pt|en`)
 * ready to embed in any GitHub Profile README.md.
 */

import { ACHIEVEMENTS_CATALOG, computeTierProgress } from '../src/js/achievements.js';
import { resolveLiveUserAchievements } from './achievements.js';

const THEMES = {
  dark: {
    bg: '#0d1117',
    card: '#161b22',
    border: '#30363d',
    text: '#e6edf3',
    muted: '#8b949e',
    accent: '#2f81f7',
    success: '#3fb950'
  },
  light: {
    bg: '#ffffff',
    card: '#f6f8fa',
    border: '#d0d7de',
    text: '#1f2328',
    muted: '#59636e',
    accent: '#0969da',
    success: '#1a7f37'
  }
};

const TIER_BADGE_COLORS = {
  locked: '#6e7681',
  default: '#2f81f7',
  bronze: '#cd7f32',
  silver: '#9aa5b1',
  gold: '#d4a017'
};

/**
 * Escapes XML entities for safe SVG interpolation.
 * @param {string|number} value
 */
export function escapeSvgText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Computes active achievement progress list from live resolved metrics.
 * @param {object} live
 */
export function computeLiveBadgeSummary(live) {
  const values = {
    'pull-shark': Number(live?.mergedPullRequests || 0),
    starstruck: Number(live?.maxRepoStars || 0),
    quickdraw: live?.quickdrawUnlocked ? 1 : 0,
    yolo: Number(live?.yoloUnreviewedPrs || 0) > 0 || Number(live?.mergedPullRequests || 0) > 0 ? 1 : 0,
    'pair-extraordinaire': Number(live?.coAuthoredCommits || 0),
    'galaxy-brain': Number(live?.acceptedAnswers || 0),
    'public-sponsor': Number(live?.sponsorships || 0)
  };

  const items = ACHIEVEMENTS_CATALOG.map((def) => ({
    ...def,
    progress: computeTierProgress(def, values[def.id] || 0)
  }));

  const unlocked = items.filter((item) => item.progress.unlocked);
  return { items, unlocked, unlockedCount: unlocked.length, totalActive: items.length };
}

/**
 * Renders a crisp 495x195 SVG card designed for GitHub Profile READMEs.
 * @param {object} live
 * @param {{ theme?: 'dark'|'light', lang?: 'pt'|'en' }} [options]
 */
export function renderReadmeBadgeSvg(live, options = {}) {
  const theme = options.theme === 'light' ? THEMES.light : THEMES.dark;
  const isPt = options.lang === 'pt';
  const login = escapeSvgText(live?.login || 'github-user');
  const summary = computeLiveBadgeSummary(live);

  const title = isPt ? 'GitHub Achievements (Ao Vivo)' : 'GitHub Achievements (Live)';
  const unlockedLabel = `${summary.unlockedCount}/${summary.totalActive} ${isPt ? 'ativas' : 'active'}`;

  const kpis = [
    { label: isPt ? 'PRs Mergeados' : 'Merged PRs', value: Number(live?.mergedPullRequests || 0) },
    { label: 'Galaxy Brain', value: Number(live?.acceptedAnswers || 0) },
    { label: 'Co-authored', value: Number(live?.coAuthoredCommits || 0) },
    { label: isPt ? 'Top Stars' : 'Top Stars', value: Number(live?.maxRepoStars || 0) }
  ];

  const kpiSvg = kpis
    .map((kpi, idx) => {
      const x = 20 + idx * 116;
      return `
        <g transform="translate(${x}, 54)">
          <rect width="108" height="52" rx="8" fill="${theme.card}" stroke="${theme.border}" />
          <text x="10" y="21" font-size="10.5" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${escapeSvgText(kpi.label)}</text>
          <text x="10" y="42" font-size="18" font-weight="700" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${escapeSvgText(kpi.value)}</text>
        </g>`;
    })
    .join('');

  const pillItems = summary.unlocked.slice(0, 5);
  const pillsSvg =
    pillItems.length > 0
      ? pillItems
          .map((item, idx) => {
            const x = 20 + idx * 92;
            const color = TIER_BADGE_COLORS[item.progress.currentTier] || TIER_BADGE_COLORS.default;
            const shortName = item.name.length > 11 ? `${item.name.slice(0, 10)}.` : item.name;
            return `
              <g transform="translate(${x}, 120)">
                <rect width="86" height="36" rx="7" fill="${theme.card}" stroke="${color}" stroke-width="1.2" />
                <text x="8" y="15" font-size="10" font-weight="600" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${escapeSvgText(shortName)}</text>
                <text x="8" y="29" font-size="9.5" font-weight="700" fill="${color}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${escapeSvgText(item.progress.currentLabel)}</text>
              </g>`;
          })
          .join('')
      : `<text x="20" y="142" font-size="12" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${isPt ? 'Nenhuma conquista pública detectada ainda.' : 'No public achievements detected yet.'}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195" role="img" aria-label="GitHub Achievements for @${login}">
  <rect x="0.5" y="0.5" width="494" height="194" rx="12" fill="${theme.bg}" stroke="${theme.border}" />
  <text x="20" y="31" font-size="15" font-weight="700" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">@${login} · ${escapeSvgText(title)}</text>
  <rect x="392" y="14" width="83" height="22" rx="11" fill="${theme.card}" stroke="${theme.success}" />
  <text x="433.5" y="29" text-anchor="middle" font-size="11" font-weight="700" fill="${theme.success}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${escapeSvgText(unlockedLabel)}</text>
  ${kpiSvg}
  ${pillsSvg}
  <text x="20" y="179" font-size="10.5" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">Live via github-achievement-tracker.vercel.app</text>
</svg>`;
}

/**
 * Vercel Serverless Handler for `/api/badge`.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const parsedUrl = new URL(req.url, 'https://localhost');
  const rawUser = req.query?.user || parsedUrl.searchParams.get('user');
  const theme = req.query?.theme || parsedUrl.searchParams.get('theme') || 'dark';
  const lang = req.query?.lang || parsedUrl.searchParams.get('lang') || 'en';

  if (!rawUser) {
    res.status(400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Missing required query parameter: user');
    return;
  }

  try {
    const live = await resolveLiveUserAchievements(rawUser, {
      token: process.env.GITHUB_TOKEN || ''
    });
    const svg = renderReadmeBadgeSvg(live, { theme, lang });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(svg);
  } catch (err) {
    res.status(err?.status === 404 ? 404 : 400).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(err?.message || 'Unable to generate badge.');
  }
}
