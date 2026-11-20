/**
 * Interactive toolkit panels: Pair Extraordinaire Co-author Generator,
 * Galaxy Brain Q&A Finder, and Profile README / JSON Exporter.
 */

import { resolveCollaborator, buildCoAuthoredCommit } from './coauthor.js';
import { buildMarkdownReport, buildJsonReport } from './exporter.js';
import { buildProfileCardSvg, fetchAvatarAsDataUrl, renderSvgToPngBlob } from './card-generator.js';
import { calculatePullSharkRoadmap, extractMergedPrCount, formatEstimatedDate } from './pace-calculator.js';
import {
  GITHUB_APPEARANCE_URL,
  SKIN_TONE_OPTIONS,
  SKIN_TONE_STORAGE_KEY,
  getSkinToneOption,
} from './skin-tones.js';
import { recordProfileSnapshot, clearProfileHistory } from './history.js';
import { compareProfiles } from './comparator.js';
import { fetchUserDashboardData } from './github-api.js';
import { analyzeDashboardData } from './analyzer.js';
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
      <h3>👋 ${escapeHtml(t(lang, 'skinToneTitle'))}</h3>
      <p class="small muted">${escapeHtml(t(lang, 'skinToneDesc'))}</p>
      <div id="skin-tone-picker" class="skin-tone-picker" role="group" aria-label="${escapeHtml(t(lang, 'skinToneTitle'))}">
        ${SKIN_TONE_OPTIONS.map(
          (opt) => `
            <button
              type="button"
              class="skin-tone-btn"
              data-tone="${escapeHtml(opt.id)}"
              title="${escapeHtml(lang === 'en' ? opt.labelEn : opt.labelPt)}"
            >${opt.emoji}</button>
          `
        ).join('')}
      </div>
      <div id="skin-tone-preview" class="skin-tone-preview"></div>
      <div class="btn-row">
        <a class="btn" href="${escapeHtml(GITHUB_APPEARANCE_URL)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(t(lang, 'skinToneAction'))}
        </a>
      </div>
    </article>

    <article class="panel">
      <h3>📈 ${escapeHtml(t(lang, 'historyTitle'))}</h3>
      <p class="small muted">${escapeHtml(t(lang, 'historyDesc'))}</p>
      <div id="history-deltas" class="history-deltas"></div>
      <div id="history-list" class="history-list"></div>
      <div class="btn-row">
        <button id="clear-history-btn" class="btn" type="button">${escapeHtml(t(lang, 'historyClear'))}</button>
      </div>
    </article>

    <article class="panel">
      <h3>⚔️ ${escapeHtml(t(lang, 'compareTitle'))}</h3>
      <p class="small muted">${escapeHtml(t(lang, 'compareDesc'))}</p>
      <form id="compare-form" class="token-drawer-body" style="margin-top:12px">
        <input
          id="compare-username"
          class="input"
          type="text"
          required
          placeholder="${escapeHtml(t(lang, 'comparePlaceholder'))}"
        />
        <div class="btn-row">
          <button class="btn btn-primary" type="submit">${escapeHtml(t(lang, 'compareBtn'))}</button>
        </div>
      </form>
      <div id="compare-output" class="compare-output hidden"></div>
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
  const currentMergedPrs = extractMergedPrCount(analysis);

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

  const skinTonePicker = container.querySelector('#skin-tone-picker');
  const skinTonePreview = container.querySelector('#skin-tone-preview');
  let savedToneId = 'default';
  try {
    savedToneId = localStorage.getItem(SKIN_TONE_STORAGE_KEY) || 'default';
  } catch {
    savedToneId = 'default';
  }

  const renderSkinTone = (toneId) => {
    const opt = getSkinToneOption(toneId);
    const label = lang === 'en' ? opt.labelEn : opt.labelPt;
    skinTonePicker?.querySelectorAll('.skin-tone-btn').forEach((btn) => {
      const isSelected = btn.dataset.tone === opt.id;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });
    if (skinTonePreview) {
      skinTonePreview.innerHTML = `
        <span class="skin-swatch" style="background:${escapeHtml(opt.swatch)}"></span>
        <span>${opt.emoji} <strong>Quickdraw</strong> &amp; <strong>Starstruck</strong> — ${escapeHtml(
          t(lang, 'skinToneSelected', { label })
        )}</span>
      `;
    }
    try {
      localStorage.setItem(SKIN_TONE_STORAGE_KEY, opt.id);
    } catch {
      // Ignore private browsing storage errors
    }
  };

  renderSkinTone(savedToneId);
  skinTonePicker?.addEventListener('click', (event) => {
    const btn = event.target.closest('.skin-tone-btn');
    if (!btn) return;
    renderSkinTone(btn.dataset.tone);
  });

  const historyDeltasEl = container.querySelector('#history-deltas');
  const historyListEl = container.querySelector('#history-list');
  const clearHistoryBtn = container.querySelector('#clear-history-btn');

  const formatSigned = (num) => (num > 0 ? `+${num}` : String(num));

  const renderHistory = (historyState) => {
    if (!historyDeltasEl || !historyListEl) return;
    if (!historyState.delta) {
      historyDeltasEl.innerHTML = `<p class="small muted">${escapeHtml(t(lang, 'historyFirst'))}</p>`;
    } else if (!historyState.delta.hasChanges) {
      historyDeltasEl.innerHTML = `<p class="small muted">${escapeHtml(t(lang, 'historyNoChange'))}</p>`;
    } else {
      const d = historyState.delta;
      const pills = [
        { label: 'PRs', val: d.mergedPullRequests },
        { label: 'Top ⭐', val: d.maxRepoStars },
        { label: 'Total ⭐', val: d.totalStars },
        { label: '🏆', val: d.unlockedCount },
      ]
        .filter((p) => p.val !== 0)
        .map(
          (p) =>
            `<span class="delta-pill ${p.val > 0 ? 'positive' : ''}">${escapeHtml(formatSigned(p.val))} ${escapeHtml(p.label)}</span>`
        )
        .join('');
      historyDeltasEl.innerHTML = pills;
    }

    const recent = [...historyState.snapshots].reverse().slice(0, 5);
    historyListEl.innerHTML = recent
      .map((snap) => {
        const dateLabel = formatEstimatedDate(String(snap.recordedAt).slice(0, 10), lang);
        return `
          <div class="history-row">
            <strong>${escapeHtml(dateLabel)}</strong>
            <span class="small muted">${snap.mergedPullRequests} PRs · ${snap.totalStars} ⭐ · ${snap.unlockedCount} 🏆</span>
          </div>
        `;
      })
      .join('');
  };

  const initialHistory = recordProfileSnapshot(analysis);
  renderHistory(initialHistory);

  clearHistoryBtn?.addEventListener('click', () => {
    clearProfileHistory(analysis.profile.login);
    if (historyDeltasEl) {
      historyDeltasEl.innerHTML = `<p class="small muted">${escapeHtml(t(lang, 'historyCleared'))}</p>`;
    }
    if (historyListEl) historyListEl.innerHTML = '';
  });

  const compareForm = container.querySelector('#compare-form');
  const compareOutput = container.querySelector('#compare-output');

  compareForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const otherUsername = container.querySelector('#compare-username')?.value.trim();
    if (!otherUsername || !compareOutput) return;

    compareOutput.classList.remove('hidden');
    compareOutput.innerHTML = `<p class="small muted">${escapeHtml(t(lang, 'loading'))}</p>`;

    try {
      const otherRaw = await fetchUserDashboardData(otherUsername, { token: getToken() });
      const otherAnalysis = analyzeDashboardData(otherRaw);
      const cmp = compareProfiles(analysis, otherAnalysis);
      const rowsHtml = cmp.rows
        .map((row) => {
          const metricLabel = t(lang, `compareMetrics.${row.key}`);
          return `
            <tr>
              <td>${escapeHtml(metricLabel)}</td>
              <td class="${row.winner === 'left' ? 'compare-win' : ''}">${row.leftValue}</td>
              <td class="${row.winner === 'right' ? 'compare-win' : ''}">${row.rightValue}</td>
            </tr>
          `;
        })
        .join('');

      compareOutput.innerHTML = `
        <p class="small" style="margin-bottom:8px">
          <strong>${escapeHtml(
            t(lang, 'compareScore', {
              left: cmp.left.login,
              right: cmp.right.login,
              leftWins: cmp.score.leftWins,
              rightWins: cmp.score.rightWins,
            })
          )}</strong>
        </p>
        <table class="compare-table">
          <thead>
            <tr>
              <th>${escapeHtml(t(lang, 'compareMetric'))}</th>
              <th>@${escapeHtml(cmp.left.login)}</th>
              <th>@${escapeHtml(cmp.right.login)}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } catch (err) {
      const msgKey = err?.code === 'RATE_LIMITED' ? 'errorRateLimit' : 'errorNotFound';
      compareOutput.innerHTML = `<p class="small" style="color:var(--danger)">${escapeHtml(t(lang, msgKey))}</p>`;
    }
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
