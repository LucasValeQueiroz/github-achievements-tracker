/**
 * Main browser application controller for GitHub Achievements Tracker.
 */

import { PROFILE_HIGHLIGHTS, RETIRED_ACHIEVEMENTS } from './achievements.js';
import { fetchUserDashboardData, GitHubApiError } from './github-api.js';
import { analyzeDashboardData } from './analyzer.js';
import { t } from './i18n.js';

const state = {
  lang: localStorage.getItem('gat_lang') || 'pt',
  theme: localStorage.getItem('gat_theme') || 'dark',
  rawData: null,
  analysis: null,
  manualOverrides: {
    coAuthoredPullRequests: 0,
    acceptedAnswers: 0,
    sponsorships: 0
  }
};

const els = {
  html: document.documentElement,
  form: document.getElementById('search-form'),
  usernameInput: document.getElementById('username-input'),
  tokenInput: document.getElementById('token-input'),
  statusBanner: document.getElementById('status-banner'),
  dashboard: document.getElementById('dashboard'),
  profileSection: document.getElementById('profile-section'),
  kpiGrid: document.getElementById('kpi-grid'),
  rateLimitPill: document.getElementById('rate-limit-pill'),
  achievementsGrid: document.getElementById('achievements-grid'),
  recommendationsList: document.getElementById('recommendations-list'),
  topReposList: document.getElementById('top-repos-list'),
  toolkitMount: document.getElementById('toolkit-mount'),
  highlightsMount: document.getElementById('highlights-mount'),
  langToggle: document.getElementById('lang-toggle'),
  themeToggle: document.getElementById('theme-toggle')
};

/**
 * Escapes HTML special characters to prevent XSS when inserting API strings.
 * @param {string} value
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function applyStaticTranslations() {
  els.html.lang = state.lang === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(state.lang, node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(state.lang, node.dataset.i18nPlaceholder);
  });
  els.langToggle.textContent = state.lang === 'pt' ? 'EN' : 'PT';
}

function applyTheme() {
  els.html.dataset.theme = state.theme;
  els.themeToggle.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

function setStatus(message, isError = false) {
  if (!message) {
    els.statusBanner.classList.add('hidden');
    els.statusBanner.classList.remove('error');
    els.statusBanner.textContent = '';
    return;
  }
  els.statusBanner.textContent = message;
  els.statusBanner.classList.remove('hidden');
  els.statusBanner.classList.toggle('error', isError);
}

function renderProfile(analysis) {
  const { profile } = analysis;
  els.profileSection.innerHTML = `
    <div class="profile-identity">
      <img class="avatar" src="${escapeHtml(profile.avatarUrl)}" alt="${escapeHtml(profile.login)}" />
      <div>
        <h2>${escapeHtml(profile.name)} <span class="muted">@${escapeHtml(profile.login)}</span></h2>
        ${profile.bio ? `<p class="muted small">${escapeHtml(profile.bio)}</p>` : ''}
        <div class="profile-meta">
          <span>📦 ${profile.publicRepos} repos</span>
          <span>👥 ${profile.followers} followers</span>
          <span>🔗 <a href="${escapeHtml(profile.htmlUrl)}" target="_blank" rel="noopener noreferrer">github.com/${escapeHtml(profile.login)}</a></span>
        </div>
      </div>
    </div>
    <button id="share-profile-btn" class="btn" type="button">${escapeHtml(t(state.lang, 'shareUrl'))}</button>
  `;

  const shareBtn = document.getElementById('share-profile-btn');
  shareBtn?.addEventListener('click', async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(profile.login)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      shareBtn.textContent = t(state.lang, 'copied');
      setTimeout(() => {
        shareBtn.textContent = t(state.lang, 'shareUrl');
      }, 1800);
    } catch {
      window.prompt('URL:', shareUrl);
    }
  });
}

function renderKpis(analysis) {
  const { metrics, summary } = analysis;
  const kpis = [
    { label: t(state.lang, 'statsMergedPrs'), value: metrics.mergedPullRequests },
    { label: t(state.lang, 'statsTopStars'), value: metrics.maxRepoStars },
    { label: t(state.lang, 'statsTotalStars'), value: metrics.totalStars },
    { label: t(state.lang, 'statsUnlocked'), value: `${summary.unlockedCount} / ${summary.totalActive}` }
  ];

  els.kpiGrid.innerHTML = kpis
    .map(
      (k) => `
      <div class="kpi-card">
        <div class="kpi-label">${escapeHtml(k.label)}</div>
        <div class="kpi-value">${escapeHtml(k.value)}</div>
      </div>
    `
    )
    .join('');
}

function renderAchievements(analysis) {
  if (analysis.rateLimit) {
    els.rateLimitPill.textContent = t(state.lang, 'rateLimitInfo', {
      remaining: analysis.rateLimit.remaining,
      limit: analysis.rateLimit.limit
    });
    els.rateLimitPill.classList.remove('hidden');
  } else {
    els.rateLimitPill.classList.add('hidden');
  }

  els.achievementsGrid.innerHTML = analysis.achievements
    .map((ach) => {
      const p = ach.progress;
      const tierClass = `tier-${p.currentTier}`;
      const badgeLabel = p.unlocked ? p.currentLabel : t(state.lang, 'tierLocked');
      const sourceLabel =
        ach.source === 'api'
          ? t(state.lang, 'badgeApi')
          : ach.source === 'inferred'
            ? t(state.lang, 'badgeInferred')
            : t(state.lang, 'badgeManual');

      const nextText = p.isMaxTier
        ? t(state.lang, 'tierMax')
        : t(state.lang, 'tierNext', { label: p.nextLabel, remaining: p.remaining });

      const quickdrawNote =
        ach.id === 'quickdraw' && analysis.quickdrawEvidence.length > 0
          ? `<p class="small" style="color: var(--success)">⚡ ${escapeHtml(
              t(state.lang, 'quickdrawEvidence', { seconds: analysis.quickdrawEvidence[0].secondsToClose })
            )}</p>`
          : '';

      const manualControl =
        ach.trackableViaApi === 'manual' && ach.id !== 'yolo'
          ? `<label class="manual-input-row">
              <span class="muted">${escapeHtml(t(state.lang, 'badgeManual'))}:</span>
              <input
                type="number"
                min="0"
                max="5000"
                class="manual-number"
                data-manual-metric="${escapeHtml(ach.metricKey)}"
                value="${escapeHtml(p.value)}"
              />
            </label>`
          : '';

      return `
        <article class="ach-card ${tierClass}">
          <div class="ach-head">
            <div class="ach-title">
              <span aria-hidden="true">${ach.emoji}</span>
              <span>${escapeHtml(ach.name)}</span>
            </div>
            <span class="pill ${tierClass}">${escapeHtml(badgeLabel)}</span>
          </div>
          <p class="small muted">${escapeHtml(t(state.lang, `achievements.${ach.id}.desc`))}</p>
          ${quickdrawNote}
          <div class="progress-track" role="progressbar" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill" style="width: ${p.percent}%"></div>
          </div>
          <div class="ach-footer">
            <span>${escapeHtml(nextText)}</span>
            <span class="pill">${escapeHtml(sourceLabel)}</span>
          </div>
          ${manualControl}
          <p class="small muted">💡 ${escapeHtml(t(state.lang, `achievements.${ach.id}.tip`))}</p>
        </article>
      `;
    })
    .join('');

  els.achievementsGrid.querySelectorAll('[data-manual-metric]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const key = event.target.dataset.manualMetric;
      const val = Math.max(0, Number.parseInt(event.target.value, 10) || 0);
      state.manualOverrides[key] = val;
      recomputeAndRender();
    });
  });
}

function renderRecommendations(analysis) {
  els.recommendationsList.innerHTML = analysis.recommendations
    .map(
      (rec) => `
      <li>
        <strong>${escapeHtml(rec.name)}</strong> —
        ${escapeHtml(t(state.lang, 'tierNext', { label: rec.nextLabel, remaining: rec.remaining }))}
      </li>
    `
    )
    .join('');
}

function renderTopRepos(analysis) {
  if (analysis.topRepositories.length === 0) {
    els.topReposList.innerHTML = `<p class="muted small">${escapeHtml(t(state.lang, 'noRepos'))}</p>`;
    return;
  }

  els.topReposList.innerHTML = analysis.topRepositories
    .map(
      (repo) => `
      <div class="repo-row">
        <div>
          <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(repo.name)}</strong></a>
          ${repo.language ? `<span class="pill" style="margin-left:6px">${escapeHtml(repo.language)}</span>` : ''}
          ${repo.description ? `<p class="small muted">${escapeHtml(repo.description)}</p>` : ''}
        </div>
        <span class="pill">⭐ ${repo.stars}</span>
      </div>
    `
    )
    .join('');
}

function renderHighlightsAndRetired() {
  const highlightsHtml = PROFILE_HIGHLIGHTS.map(
    (h) => `
      <div class="repo-row">
        <div>
          <strong>${h.emoji} ${escapeHtml(h.name)}</strong>
          <p class="small muted">${escapeHtml(t(state.lang, `highlights.${h.id}`))}</p>
        </div>
        <a class="pill" href="${escapeHtml(h.url)}" target="_blank" rel="noopener noreferrer">↗</a>
      </div>
    `
  ).join('');

  const retiredHtml = RETIRED_ACHIEVEMENTS.map(
    (r) => `
      <div class="repo-row">
        <div>
          <strong>${r.emoji} ${escapeHtml(r.name)}</strong>
          <p class="small muted">${escapeHtml(t(state.lang, `retired.${r.id}`))}</p>
        </div>
        <span class="pill">${r.year}</span>
      </div>
    `
  ).join('');

  els.highlightsMount.innerHTML = `
    <div class="panel">
      <h3>${escapeHtml(t(state.lang, 'highlightsTitle'))}</h3>
      <div class="repos-list">${highlightsHtml}</div>
    </div>
    <div class="panel">
      <h3>${escapeHtml(t(state.lang, 'retiredTitle'))}</h3>
      <div class="repos-list">${retiredHtml}</div>
    </div>
  `;
}

function recomputeAndRender() {
  if (!state.rawData) return;
  state.analysis = analyzeDashboardData(state.rawData, state.manualOverrides);
  renderProfile(state.analysis);
  renderKpis(state.analysis);
  renderAchievements(state.analysis);
  renderRecommendations(state.analysis);
  renderTopRepos(state.analysis);
  renderHighlightsAndRetired();
  els.dashboard.classList.remove('hidden');
}

async function loadUser(username) {
  const trimmed = String(username || '').trim();
  if (!trimmed) return;

  setStatus(t(state.lang, 'loading'));
  try {
    const token = els.tokenInput.value.trim();
    const rawData = await fetchUserDashboardData(trimmed, { token });
    state.rawData = rawData;

    const url = new URL(window.location.href);
    url.searchParams.set('user', rawData.profile.login);
    window.history.replaceState({}, '', url);

    setStatus('');
    recomputeAndRender();
  } catch (err) {
    if (err instanceof GitHubApiError) {
      if (err.code === 'NOT_FOUND') {
        setStatus(t(state.lang, 'errorNotFound'), true);
        return;
      }
      if (err.code === 'RATE_LIMITED') {
        setStatus(t(state.lang, 'errorRateLimit'), true);
        return;
      }
    }
    setStatus(t(state.lang, 'errorGeneric'), true);
  }
}

function init() {
  applyTheme();
  applyStaticTranslations();

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    loadUser(els.usernameInput.value);
  });

  els.langToggle.addEventListener('click', () => {
    state.lang = state.lang === 'pt' ? 'en' : 'pt';
    localStorage.setItem('gat_lang', state.lang);
    applyStaticTranslations();
    recomputeAndRender();
  });

  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('gat_theme', state.theme);
    applyTheme();
  });

  const params = new URLSearchParams(window.location.search);
  const initialUser = params.get('user') || 'LucasValeQueiroz';
  els.usernameInput.value = initialUser;
  loadUser(initialUser);
}

init();
