/**
 * Shareable 1200x630 Profile Achievement Card generator (SVG + PNG export).
 * Pure SVG builder runs in both browser and Node.js; PNG rasterization uses
 * HTML5 Canvas in the browser with zero external dependencies.
 */

const TIER_PALETTE = {
  locked: { stroke: '#6e7681', text: '#8b949e', fill: '#6e7681', bg: 'rgba(110,118,129,0.16)' },
  default: { stroke: '#2f81f7', text: '#58a6ff', fill: '#2f81f7', bg: 'rgba(47,129,247,0.16)' },
  bronze: { stroke: '#cd7f32', text: '#e09145', fill: '#cd7f32', bg: 'rgba(205,127,50,0.18)' },
  silver: { stroke: '#a8b3be', text: '#c9d1d9', fill: '#a8b3be', bg: 'rgba(168,179,190,0.18)' },
  gold: { stroke: '#e3b341', text: '#f2cc60', fill: '#e3b341', bg: 'rgba(227,179,65,0.20)' }
};

/**
 * Escapes XML special characters so arbitrary GitHub display names/bios are safe in SVG.
 * @param {string} value
 */
export function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Truncates text cleanly to fit fixed SVG regions.
 * @param {string} value
 * @param {number} maxLen
 */
export function truncateText(value, maxLen) {
  const str = String(value ?? '').trim();
  if (str.length <= maxLen) return str;
  return `${str.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

/**
 * Computes two-letter monogram initials for avatar fallback.
 * @param {string} name
 * @param {string} login
 */
export function getInitials(name, login) {
  const source = String(name || login || 'GH').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Generates a self-contained 1200x630 SVG card summarizing a GitHub user's achievements.
 * @param {object} analysis
 * @param {{ theme?: 'dark'|'light', lang?: 'pt'|'en', avatarDataUrl?: string }} [options]
 */
export function buildProfileCardSvg(analysis, options = {}) {
  const theme = options.theme === 'light' ? 'light' : 'dark';
  const isPt = options.lang !== 'en';
  const avatarDataUrl = options.avatarDataUrl || '';

  const palette = theme === 'light'
    ? {
        bg: '#f6f8fa',
        card: '#ffffff',
        row: '#f6f8fa',
        border: '#d0d7de',
        text: '#1f2328',
        muted: '#59636e',
        accent: '#0969da',
        track: '#dde3ea',
        glowA: 'rgba(9,105,218,0.12)',
        glowB: 'rgba(130,80,223,0.12)'
      }
    : {
        bg: '#0d1117',
        card: '#161b22',
        row: '#0d1117',
        border: '#30363d',
        text: '#e6edf3',
        muted: '#8b949e',
        accent: '#58a6ff',
        track: '#21262d',
        glowA: 'rgba(47,129,247,0.22)',
        glowB: 'rgba(163,113,247,0.18)'
      };

  const profile = analysis?.profile || {};
  const metrics = analysis?.metrics || {};
  const summary = analysis?.summary || { unlockedCount: 0, totalActive: 7 };
  const achievements = Array.isArray(analysis?.achievements) ? analysis.achievements : [];

  const displayName = escapeXml(truncateText(profile.name || profile.login || 'GitHub User', 26));
  const login = escapeXml(truncateText(profile.login || 'user', 28));
  const initials = escapeXml(getInitials(profile.name, profile.login));
  const subtitle = escapeXml(
    truncateText(
      profile.bio || (isPt ? 'Progresso real em GitHub Achievements via REST API' : 'Live GitHub Achievements progress via REST API'),
      62
    )
  );

  const featuredIds = ['pull-shark', 'quickdraw', 'starstruck', 'pair-extraordinaire', 'galaxy-brain'];
  const rows = featuredIds
    .map((id) => achievements.find((a) => a.id === id))
    .filter(Boolean)
    .slice(0, 5);

  const rowMarkup = rows
    .map((ach, index) => {
      const y = 112 + index * 92;
      const p = ach.progress || { currentTier: 'locked', currentLabel: 'Locked', percent: 0, value: 0, nextThreshold: 1, isMaxTier: false };
      const tStyle = TIER_PALETTE[p.currentTier] || TIER_PALETTE.locked;
      const badgeLabel = p.unlocked
        ? escapeXml(p.currentLabel)
        : escapeXml(isPt ? 'Bloqueado' : 'Locked');
      const rightMeta = p.isMaxTier
        ? `${p.value} · MAX`
        : `${p.value} / ${p.nextThreshold} (${p.percent}%)`;
      const fillWidth = Math.max(8, Math.round((Math.min(100, Math.max(0, p.percent)) / 100) * 432));

      return `
      <g transform="translate(652, ${y})">
        <rect x="0" y="0" width="472" height="78" rx="12" fill="${palette.row}" stroke="${palette.border}" />
        <text x="18" y="30" fill="${palette.text}" font-size="16" font-weight="700">${escapeXml(ach.name)}</text>
        <rect x="348" y="12" width="106" height="24" rx="12" fill="${tStyle.bg}" stroke="${tStyle.stroke}" />
        <text x="401" y="29" text-anchor="middle" fill="${tStyle.text}" font-size="12" font-weight="700">${badgeLabel}</text>
        <rect x="18" y="46" width="432" height="8" rx="4" fill="${palette.track}" />
        <rect x="18" y="46" width="${fillWidth}" height="8" rx="4" fill="${tStyle.fill}" />
        <text x="450" y="69" text-anchor="end" fill="${palette.muted}" font-size="11" font-weight="600">${escapeXml(rightMeta)}</text>
      </g>`;
    })
    .join('');

  const avatarMarkup = avatarDataUrl
    ? `<defs><clipPath id="avatar-clip"><circle cx="116" cy="148" r="46" /></clipPath></defs>
       <circle cx="116" cy="148" r="49" fill="none" stroke="${palette.accent}" stroke-width="2.5" />
       <image href="${escapeXml(avatarDataUrl)}" x="70" y="102" width="92" height="92" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice" />`
    : `<circle cx="116" cy="148" r="46" fill="${palette.card}" stroke="${palette.accent}" stroke-width="2.5" />
       <text x="116" y="159" text-anchor="middle" fill="${palette.accent}" font-size="30" font-weight="800">${initials}</text>`;

  const kpiLabels = isPt
    ? ['PRs Mergeados', 'Maior nº Estrelas', 'Conquistas Ativas']
    : ['Merged PRs', 'Top Repo Stars', 'Active Badges'];

  const kpiValues = [
    String(metrics.mergedPullRequests ?? 0),
    String(metrics.maxRepoStars ?? 0),
    `${summary.unlockedCount}/${summary.totalActive}`
  ];

  const kpisMarkup = kpiValues
    .map((val, idx) => {
      const x = 68 + idx * 176;
      return `
      <g transform="translate(${x}, 312)">
        <rect x="0" y="0" width="162" height="98" rx="14" fill="${palette.card}" stroke="${palette.border}" />
        <text x="18" y="34" fill="${palette.muted}" font-size="13" font-weight="600">${escapeXml(kpiLabels[idx])}</text>
        <text x="18" y="76" fill="${palette.text}" font-size="32" font-weight="800">${escapeXml(val)}</text>
      </g>`;
    })
    .join('');

  const footerLabel = isPt
    ? 'Gerado com GitHub Achievements Tracker'
    : 'Generated with GitHub Achievements Tracker';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="GitHub Achievements Card for @${login}">
  <defs>
    <radialGradient id="glow-a" cx="14%" cy="18%" r="48%">
      <stop offset="0%" stop-color="${palette.glowA}" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>
    <radialGradient id="glow-b" cx="88%" cy="84%" r="50%">
      <stop offset="0%" stop-color="${palette.glowB}" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="${palette.bg}" />
  <rect width="1200" height="630" fill="url(#glow-a)" />
  <rect width="1200" height="630" fill="url(#glow-b)" />

  <g font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif">
    <rect x="68" y="48" width="296" height="32" rx="16" fill="${palette.card}" stroke="${palette.border}" />
    <text x="216" y="69" text-anchor="middle" fill="${palette.accent}" font-size="12" font-weight="700" letter-spacing="1">GITHUB ACHIEVEMENTS CARD</text>

    ${avatarMarkup}
    <text x="184" y="142" fill="${palette.text}" font-size="34" font-weight="800">${displayName}</text>
    <text x="184" y="174" fill="${palette.accent}" font-size="20" font-weight="600">@${login}</text>

    <text x="68" y="246" fill="${palette.muted}" font-size="18">${subtitle}</text>

    ${kpisMarkup}

    <rect x="68" y="452" width="514" height="72" rx="14" fill="${palette.card}" stroke="${palette.border}" />
    <text x="90" y="482" fill="${palette.muted}" font-size="13" font-weight="600">${escapeXml(footerLabel)}</text>
    <text x="90" y="507" fill="${palette.accent}" font-size="15" font-weight="700" font-family="Consolas, ui-monospace, monospace">lucasvalequeiroz.github.io/github-achievements-tracker</text>

    <rect x="628" y="48" width="520" height="534" rx="20" fill="${palette.card}" stroke="${palette.border}" />
    <text x="652" y="88" fill="${palette.text}" font-size="18" font-weight="800">${escapeXml(isPt ? 'Progresso de Conquistas' : 'Achievements Progress')}</text>
    ${rowMarkup}
  </g>
</svg>`;
}

/**
 * Best-effort conversion of a GitHub avatar URL to an inline data URL so SVG->Canvas
 * export stays CORS-clean; silently falls back to empty string (initials monogram).
 * @param {string} avatarUrl
 */
export async function fetchAvatarAsDataUrl(avatarUrl) {
  if (!avatarUrl || typeof fetch !== 'function' || typeof FileReader === 'undefined') {
    return '';
  }
  try {
    const resp = await fetch(avatarUrl, { mode: 'cors' });
    if (!resp.ok) return '';
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/**
 * Rasterizes an SVG string into a crisp PNG Blob via HTML5 Canvas (browser only).
 * @param {string} svgMarkup
 * @param {number} [width=1200]
 * @param {number} [height=630]
 * @returns {Promise<Blob>}
 */
export async function renderSvgToPngBlob(svgMarkup, width = 1200, height = 630) {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load SVG into Image for PNG export.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas PNG export returned null.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
