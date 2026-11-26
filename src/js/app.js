/**
 * Main browser application controller for GitHub Achievements Tracker.
 */

import { PROFILE_HIGHLIGHTS, RETIRED_ACHIEVEMENTS } from './achievements.js';
import {
  fetchUserDashboardData,
  fetchRuntimeConfig,
  GitHubApiError
} from './github-api.js';
import { analyzeDashboardData } from './analyzer.js';
import { renderToolkit } from './toolkit-ui.js';
import { buildProfileCardSvg, fetchAvatarAsDataUrl, renderSvgToPngBlob } from './card-generator.js';
import {
  buildRegisterIssueUrl,
  fetchCommunityProfiles,
  isProfileRegistered,
  filterAndSortCommunity
} from './community.js';
import { t } from './i18n.js';

const VISIBILITY_STALE_MS = 2 * 60 * 1000;
const DEFAULT_AUTO_REFRESH_MS = 5 * 60 * 1000;

const state = {
  lang: localStorage.getItem('gat_lang') || 'pt',
  theme: localStorage.getItem('gat_theme') || 'dark',
  autoRefreshEnabled: localStorage.getItem('gat_auto_refresh') !== 'off',
  autoRefreshMs: DEFAULT_AUTO_REFRESH_MS,
  autoRefreshTimer: null,
  isFetching: false,
  currentLogin: '',
  rawData: null,
  analysis: null,
  manualOverrides: {},
  communityProfiles: [],
  communityQuery: '',
  communitySortBy: 'mergedPullRequests'
};

const els = {
  html: document.documentElement,
  form: document.getElementById('search-form'),
  usernameInput: document.getElementById('username-input'),
  tokenInput: document.getElementById('token-input'),
  rememberTokenCheckbox: document.getElementById('remember-token'),
  statusBanner: document.getElementById('status-banner'),
  dashboard: document.getElementById('dashboard'),
  profileSection: document.getElementById('profile-section'),
  kpiGrid: document.getElementById('kpi-grid'),
  rateLimitPill: document.getElementById('rate-limit-pill'),
  liveSyncBar: document.getElementById('live-sync-bar'),
  achievementsGrid: document.getElementById('achievements-grid'),
  recommendationsList: document.getElementById('recommendations-list'),
  topReposList: document.getElementById('top-repos-list'),
  toolkitMount: document.getElementById('toolkit-mount'),
  communityList: document.getElementById('community-list'),
  communitySearch: document.getElementById('community-search'),
  communitySort: document.getElementById('community-sort'),
  communityRegisterCta: document.getElementById('community-register-cta'),
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

function formatSyncTime(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString(state.lang === 'pt' ? 'pt-BR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
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

function renderLiveSyncBar(analysis) {
  if (!els.liveSyncBar || !analysis) return;
  const timeStr = formatSyncTime(analysis.fetchedAt);
  const autoLabel = state.autoRefreshEnabled
    ? t(state.lang, 'autoRefreshOn')
    : t(state.lang, 'autoRefreshOff');

  els.liveSyncBar.innerHTML = `
    <span class="pill live-pill">
      <span class="live-dot ${state.autoRefreshEnabled ? 'active' : ''}" aria-hidden="true"></span>
      ${escapeHtml(t(state.lang, 'lastUpdated', { time: timeStr }))}
    </span>
    <button id="refresh-now-btn" class="icon-btn" type="button" ${state.isFetching ? 'disabled' : ''}>
      🔄 ${escapeHtml(t(state.lang, 'refreshNow'))}
    </button>
    <button id="auto-refresh-toggle" class="icon-btn" type="button" aria-pressed="${state.autoRefreshEnabled}">
      ⚡ ${escapeHtml(autoLabel)}
    </button>
  `;

  document.getElementById('refresh-now-btn')?.addEventListener('click', () => {
    if (state.currentLogin) {
      loadUser(state.currentLogin, { forceRefresh: true });
    }
  });

  document.getElementById('auto-refresh-toggle')?.addEventListener('click', () => {
    state.autoRefreshEnabled = !state.autoRefreshEnabled;
    localStorage.setItem('gat_auto_refresh', state.autoRefreshEnabled ? 'on' : 'off');
    scheduleAutoRefresh();
    renderLiveSyncBar(state.analysis);
  });
}

function scheduleAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
  if (!state.autoRefreshEnabled) return;

  state.autoRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && state.currentLogin && !state.isFetching) {
      loadUser(state.currentLogin, { forceRefresh: true, silent: true });
    }
  }, state.autoRefreshMs);
}

function renderProfile(analysis) {
  const { profile } = analysis;
  const alreadyRegistered = isProfileRegistered(state.communityProfiles, profile.login);
  const registerUrl = buildRegisterIssueUrl(profile.login);

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
    <div class="btn-row" style="margin-top:0">
      <button id="download-profile-png-btn" class="btn btn-primary" type="button">🖼️ ${escapeHtml(t(state.lang, 'downloadCardPng'))}</button>
      <button id="share-profile-btn" class="btn" type="button">${escapeHtml(t(state.lang, 'shareUrl'))}</button>
      ${
        alreadyRegistered
          ? `<span class="pill" style="color: var(--success)">✅ ${escapeHtml(t(state.lang, 'communityRegisteredBadge'))}</span>`
          : `<a class="btn" href="${escapeHtml(registerUrl)}" target="_blank" rel="noopener noreferrer">➕ ${escapeHtml(t(state.lang, 'communityRegisterThis'))}</a>`
      }
    </div>
  `;

  if (els.communityRegisterCta) {
    els.communityRegisterCta.href = registerUrl;
  }

  const downloadPngBtn = document.getElementById('download-profile-png-btn');
  downloadPngBtn?.addEventListener('click', async () => {
    const defaultHtml = downloadPngBtn.innerHTML;
    downloadPngBtn.disabled = true;
    downloadPngBtn.textContent = t(state.lang, 'generatingCard');
    try {
      const avatarDataUrl = await fetchAvatarAsDataUrl(profile.avatarUrl);
      const svg = buildProfileCardSvg(analysis, {
        theme: state.theme,
        lang: state.lang,
        avatarDataUrl
      });
      const pngBlob = await renderSvgToPngBlob(svg, 1200, 630);
      const url = URL.createObjectURL(pngBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `github-achievements-${profile.login || 'card'}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      downloadPngBtn.disabled = false;
      downloadPngBtn.innerHTML = defaultHtml;
    }
  });

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

function renderCommunityDirectory() {
  if (!els.communityList) return;
  const items = filterAndSortCommunity(state.communityProfiles, {
    query: state.communityQuery,
    sortBy: state.communitySortBy
  });

  if (items.length === 0) {
    els.communityList.innerHTML = `<p class="muted small">${escapeHtml(t(state.lang, 'communityEmpty'))}</p>`;
    return;
  }

  els.communityList.innerHTML = items
    .map((item) => {
      const isActive = item.login.toLowerCase() === state.currentLogin.toLowerCase();
      return `
        <button type="button" class="community-card ${isActive ? 'active' : ''}" data-community-user="${escapeHtml(item.login)}">
          <div class="community-card-head">
            <img class="community-avatar" src="https://github.com/${encodeURIComponent(item.login)}.png?size=64" alt="${escapeHtml(item.login)}" loading="lazy" />
            <strong>@${escapeHtml(item.login)}</strong>
          </div>
          <div class="community-card-stats small muted">
            <span>🦈 ${Number(item.mergedPullRequests || 0)} PRs</span>
            <span>🧠 ${Number(item.acceptedAnswers || 0)}</span>
            <span>🤝 ${Number(item.coAuthoredCommits || 0)}</span>
          </div>
        </button>
      `;
    })
    .join('');

  els.communityList.querySelectorAll('[data-community-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.communityUser;
      els.usernameInput.value = target;
      loadUser(target, { pushHistory: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
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
        ach.source === 'manual' && ach.id !== 'yolo'
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
  renderLiveSyncBar(state.analysis);
  renderKpis(state.analysis);
  renderAchievements(state.analysis);
  renderRecommendations(state.analysis);
  renderTopRepos(state.analysis);
  renderToolkit(els.toolkitMount, state.analysis, {
    lang: state.lang,
    theme: state.theme,
    getToken: () => els.tokenInput.value.trim()
  });
  renderCommunityDirectory();
  renderHighlightsAndRetired();
  els.dashboard.classList.remove('hidden');
}

function syncRememberedToken() {
  if (!els.rememberTokenCheckbox) return;
  const token = els.tokenInput.value.trim();
  if (els.rememberTokenCheckbox.checked && token) {
    localStorage.setItem('gat_token', token);
  } else {
    localStorage.removeItem('gat_token');
  }
}

async function loadUser(username, { forceRefresh = false, silent = false, pushHistory = false } = {}) {
  const trimmed = String(username || '').trim();
  if (!trimmed || state.isFetching) return;

  state.isFetching = true;
  if (!silent) {
    setStatus(t(state.lang, 'loading'));
  }
  if (state.analysis) {
    renderLiveSyncBar(state.analysis);
  }

  try {
    const token = els.tokenInput.value.trim();
    const rawData = await fetchUserDashboardData(trimmed, { token, forceRefresh });
    state.rawData = rawData;
    state.currentLogin = rawData.profile.login;
    if (!silent) {
      state.manualOverrides = {};
    }

    localStorage.setItem('gat_last_user', rawData.profile.login);

    const url = new URL(window.location.href);
    url.searchParams.set('user', rawData.profile.login);
    if (pushHistory) {
      window.history.pushState({ user: rawData.profile.login }, '', url);
    } else {
      window.history.replaceState({ user: rawData.profile.login }, '', url);
    }

    setStatus('');
    recomputeAndRender();
    scheduleAutoRefresh();
  } catch (err) {
    if (!silent) {
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
  } finally {
    state.isFetching = false;
    if (state.analysis) {
      renderLiveSyncBar(state.analysis);
    }
  }
}

async function init() {
  applyTheme();
  applyStaticTranslations();

  const savedToken = localStorage.getItem('gat_token') || '';
  if (savedToken && els.tokenInput) {
    els.tokenInput.value = savedToken;
    if (els.rememberTokenCheckbox) {
      els.rememberTokenCheckbox.checked = true;
    }
  }

  const [runtimeConfig, communityProfiles] = await Promise.all([
    fetchRuntimeConfig(),
    fetchCommunityProfiles()
  ]);
  if (runtimeConfig?.autoRefreshMs) {
    state.autoRefreshMs = runtimeConfig.autoRefreshMs;
  }
  state.communityProfiles = communityProfiles;

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    syncRememberedToken();
    loadUser(els.usernameInput.value, { forceRefresh: true, pushHistory: true });
  });

  els.tokenInput?.addEventListener('change', syncRememberedToken);
  els.rememberTokenCheckbox?.addEventListener('change', syncRememberedToken);

  els.communitySearch?.addEventListener('input', (event) => {
    state.communityQuery = event.target.value;
    renderCommunityDirectory();
  });

  els.communitySort?.addEventListener('change', (event) => {
    state.communitySortBy = event.target.value;
    renderCommunityDirectory();
  });

  document.querySelectorAll('[data-example-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetUser = btn.dataset.exampleUser;
      els.usernameInput.value = targetUser;
      loadUser(targetUser, { pushHistory: true });
    });
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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.autoRefreshEnabled || !state.currentLogin) {
      return;
    }
    const lastFetched = Date.parse(state.rawData?.fetchedAt || 0);
    if (!Number.isFinite(lastFetched) || Date.now() - lastFetched >= VISIBILITY_STALE_MS) {
      loadUser(state.currentLogin, { forceRefresh: true, silent: true });
    }
  });

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const userFromUrl = params.get('user');
    if (userFromUrl && userFromUrl.toLowerCase() !== state.currentLogin.toLowerCase()) {
      els.usernameInput.value = userFromUrl;
      loadUser(userFromUrl);
    }
  });

  const params = new URLSearchParams(window.location.search);
  const initialUser =
    params.get('user') || localStorage.getItem('gat_last_user') || 'LucasValeQueiroz';
  els.usernameInput.value = initialUser;
  loadUser(initialUser, { forceRefresh: true });
}

init();
