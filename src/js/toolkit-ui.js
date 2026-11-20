/**
 * Interactive toolkit panels: Pair Extraordinaire Co-author Generator,
 * Galaxy Brain Q&A Finder, and Profile README / JSON Exporter.
 */

import { resolveCollaborator, buildCoAuthoredCommit } from './coauthor.js';
import { buildMarkdownReport, buildJsonReport } from './exporter.js';
import { buildProfileCardSvg, fetchAvatarAsDataUrl, renderSvgToPngBlob } from './card-generator.js';
import { calculatePullSharkRoadmap, formatEstimatedDate } from './pace-calculator.js';
import { t } from './i18n.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function copyText(text, button, defaultLabel, copiedLabel) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = copiedLabel;
    setTimeout(() => {
      button.textContent = defaultLabel;
    }, 1800);
  } catch {
    window.prompt('Copy:', text);
  }
}

/**
 * Renders the three interactive toolkit panels into the target container.
 * @param {HTMLElement} container
 * @param {object} analysis
 * @param {{ lang: 'pt'|'en', getToken: () => string }} options
 */
export function renderToolkit(container, analysis, { lang, theme = 'dark', getToken }) {
  if (!container || !analysis) return;

  const markdownSnippet = buildMarkdownReport(analysis, lang);
  const galaxyChips = analysis.galaxyBrainLinks
    .map(
      (link) => `
      <a class="chip" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
        🧠 ${escapeHtml(link.language)} ↗
      </a>
    `
    )
    .join('');

  container.innerHTML = `
    <article class="panel">
      <h3>🤝 ${escapeHtml(t(lang, 'coauthorTitle'))}</h3>
      <p class="small muted">${escapeHtml(t(lang, 'coauthorDesc'))}</p>
      <form id="coauthor-form" class="token-drawer-body" style="margin-top:12px">
        <input
          id="coauthor-username"
          class="input"
          type="text"
          required
          placeholder="${escapeHtml(t(lang, 'coauthorUserPlaceholder'))}"
        />
        <input
          id="coauthor-message"
          class="input"
          type="text"
          value="feat: pair programming contribution"
          placeholder="${escapeHtml(t(lang, 'coauthorMsgPlaceholder'))}"
        />
        <div class="btn-row">
          <button class="btn btn-primary" type="submit">${escapeHtml(t(lang, 'coauthorGenerate'))}</button>
          <button id="coauthor-copy-btn" class="btn hidden" type="button">${escapeHtml(t(lang, 'coauthorCopy'))}</button>
        </div>
      </form>
      <pre id="coauthor-output" class="code-block hidden" style="margin-top:12px"></pre>
    </article>

    <article class="panel">
      <h3>🧠 ${escapeHtml(t(lang, 'galaxyTitle'))}</h3>
      <p class="small muted">${escapeHtml(t(lang, 'galaxyDesc'))}</p>
      <div class="chip-list">${galaxyChips}</div>
    </article>

    <article class="panel">
      <h3>🦈 ${escapeHtml(t(lang, 'paceTitle'))}</h3>
      <p class="small muted">${escapeHtml(t(lang, 'paceDesc'))}</p>
      <div class="pace-controls">
        <label class="small" for="pace-slider">
          ${escapeHtml(t(lang, 'paceLabel'))}: <strong id="pace-value">3</strong> ${escapeHtml(t(lang, 'paceUnit'))}
        </label>
        <input id="pace-slider" class="pace-slider" type="range" min="0.5" max="10" step="0.5" value="3" />
      </div>
      <div id="pace-roadmap" class="pace-roadmap"></div>
    </article>

    <article class="panel">
      <h3>📋 ${escapeHtml(t(lang, 'exportTitle'))}</h3>
      <p class="small muted">${escapeHtml(t(lang, 'exportDesc'))}</p>
      <pre id="markdown-preview" class="code-block" style="margin-top:12px;max-height:200px">${escapeHtml(markdownSnippet)}</pre>
      <div class="btn-row">
        <button id="copy-md-btn" class="btn btn-primary" type="button">${escapeHtml(t(lang, 'copyMarkdown'))}</button>
        <button id="download-card-png-btn" class="btn" type="button">🖼️ ${escapeHtml(t(lang, 'downloadCardPng'))}</button>
        <button id="download-card-svg-btn" class="btn" type="button">🎨 ${escapeHtml(t(lang, 'downloadCardSvg'))}</button>
        <button id="download-json-btn" class="btn" type="button">${escapeHtml(t(lang, 'downloadJson'))}</button>
      </div>
    </article>
  `;

  const coauthorForm = container.querySelector('#coauthor-form');
  const coauthorOutput = container.querySelector('#coauthor-output');
  const coauthorCopyBtn = container.querySelector('#coauthor-copy-btn');
  let latestGitCommand = '';

  coauthorForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const collaboratorUsername = container.querySelector('#coauthor-username').value.trim();
    const commitMsg = container.querySelector('#coauthor-message').value.trim();
    if (!collaboratorUsername) return;

    coauthorOutput.classList.remove('hidden');
    coauthorOutput.textContent = t(lang, 'loading');
    coauthorCopyBtn.classList.add('hidden');

    try {
      const collaborator = await resolveCollaborator(collaboratorUsername, { token: getToken() });
      const result = buildCoAuthoredCommit(commitMsg, [collaborator]);
      latestGitCommand = result.gitCommand;
      coauthorOutput.textContent = `${result.fullMessage}\n\n# CLI:\n${result.gitCommand}`;
      coauthorCopyBtn.classList.remove('hidden');
    } catch {
      coauthorOutput.textContent = t(lang, 'errorNotFound');
    }
  });

  coauthorCopyBtn?.addEventListener('click', () => {
    if (!latestGitCommand) return;
    copyText(latestGitCommand, coauthorCopyBtn, t(lang, 'coauthorCopy'), t(lang, 'copied'));
  });

  const copyMdBtn = container.querySelector('#copy-md-btn');
  copyMdBtn?.addEventListener('click', () => {
    copyText(markdownSnippet, copyMdBtn, t(lang, 'copyMarkdown'), t(lang, 'copied'));
  });

  const paceSlider = container.querySelector('#pace-slider');
  const paceValue = container.querySelector('#pace-value');
  const paceRoadmapEl = container.querySelector('#pace-roadmap');
  const currentMergedPrs = analysis.metrics?.mergedPrCount ?? 0;

  const renderPaceRows = (prsPerDay) => {
    if (!paceRoadmapEl) return;
    if (paceValue) paceValue.textContent = String(prsPerDay);
    const items = calculatePullSharkRoadmap(currentMergedPrs, prsPerDay);
    paceRoadmapEl.innerHTML = items
      .map((item) => {
        const statusText = item.reached
          ? `✅ ${escapeHtml(t(lang, 'paceReached'))}`
          : `${escapeHtml(t(lang, 'paceRemaining', { count: item.remaining }))} · ${escapeHtml(
              t(lang, 'paceDays', {
                days: item.daysNeeded,
                date: formatEstimatedDate(item.estimatedDateIso, lang),
              })
            )}`;
        return `
          <div class="pace-row ${item.reached ? 'pace-reached' : ''}">
            <strong>${escapeHtml(item.label)} (${item.target})</strong>
            <span class="small muted">${statusText}</span>
          </div>
        `;
      })
      .join('');
  };

  renderPaceRows(Number(paceSlider?.value || 3));
  paceSlider?.addEventListener('input', (event) => {
    renderPaceRows(Number(event.target.value));
  });

  const downloadJsonBtn = container.querySelector('#download-json-btn');
  downloadJsonBtn?.addEventListener('click', () => {
    const jsonString = buildJsonReport(analysis);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `github-achievements-${analysis.profile.login || 'report'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });

  const downloadCardPngBtn = container.querySelector('#download-card-png-btn');
  downloadCardPngBtn?.addEventListener('click', async () => {
    const prevHtml = downloadCardPngBtn.innerHTML;
    downloadCardPngBtn.disabled = true;
    downloadCardPngBtn.textContent = t(lang, 'generatingCard');
    try {
      const avatarDataUrl = await fetchAvatarAsDataUrl(analysis.profile.avatarUrl);
      const svg = buildProfileCardSvg(analysis, { theme, lang, avatarDataUrl });
      const blob = await renderSvgToPngBlob(svg, 1200, 630);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `github-achievements-${analysis.profile.login || 'card'}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      downloadCardPngBtn.disabled = false;
      downloadCardPngBtn.innerHTML = prevHtml;
    }
  });

  const downloadCardSvgBtn = container.querySelector('#download-card-svg-btn');
  downloadCardSvgBtn?.addEventListener('click', () => {
    const svg = buildProfileCardSvg(analysis, { theme, lang });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `github-achievements-${analysis.profile.login || 'card'}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });
}
