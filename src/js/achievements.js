/**
 * Catalog of GitHub Profile Achievements, Profile Highlights, and Retired Badges,
 * plus pure functions for tier and progress calculation.
 */

export const TIER_ORDER = ['locked', 'default', 'bronze', 'silver', 'gold'];

export const ACHIEVEMENTS_CATALOG = [
  {
    id: 'pull-shark',
    name: 'Pull Shark',
    emoji: '🦈',
    category: 'solo',
    trackableViaApi: 'full',
    metricKey: 'mergedPullRequests',
    tiers: [
      { tier: 'default', label: 'Default', threshold: 2 },
      { tier: 'bronze', label: 'Bronze', threshold: 16 },
      { tier: 'silver', label: 'Silver', threshold: 128 },
      { tier: 'gold', label: 'Gold', threshold: 1024 }
    ]
  },
  {
    id: 'starstruck',
    name: 'Starstruck',
    emoji: '⭐',
    category: 'community',
    trackableViaApi: 'full',
    metricKey: 'maxRepoStars',
    tiers: [
      { tier: 'default', label: 'Default', threshold: 16 },
      { tier: 'bronze', label: 'Bronze', threshold: 128 },
      { tier: 'silver', label: 'Silver', threshold: 512 },
      { tier: 'gold', label: 'Gold', threshold: 4096 }
    ]
  },
  {
    id: 'quickdraw',
    name: 'Quickdraw',
    emoji: '⚡',
    category: 'solo',
    trackableViaApi: 'partial',
    metricKey: 'quickdrawMatches',
    tiers: [
      { tier: 'default', label: 'Unlocked', threshold: 1 }
    ]
  },
  {
    id: 'yolo',
    name: 'YOLO',
    emoji: '🚀',
    category: 'solo',
    trackableViaApi: 'manual',
    metricKey: 'mergedPullRequests',
    tiers: [
      { tier: 'default', label: 'Unlocked', threshold: 1 }
    ]
  },
  {
    id: 'pair-extraordinaire',
    name: 'Pair Extraordinaire',
    emoji: '🤝',
    category: 'community',
    trackableViaApi: 'manual',
    metricKey: 'coAuthoredPullRequests',
    tiers: [
      { tier: 'default', label: 'Default', threshold: 1 },
      { tier: 'bronze', label: 'Bronze', threshold: 10 },
      { tier: 'silver', label: 'Silver', threshold: 24 },
      { tier: 'gold', label: 'Gold', threshold: 48 }
    ]
  },
  {
    id: 'galaxy-brain',
    name: 'Galaxy Brain',
    emoji: '🧠',
    category: 'community',
    trackableViaApi: 'manual',
    metricKey: 'acceptedAnswers',
    tiers: [
      { tier: 'default', label: 'Default', threshold: 2 },
      { tier: 'bronze', label: 'Bronze', threshold: 8 },
      { tier: 'silver', label: 'Silver', threshold: 16 },
      { tier: 'gold', label: 'Gold', threshold: 32 }
    ]
  },
  {
    id: 'public-sponsor',
    name: 'Public Sponsor',
    emoji: '💖',
    category: 'sponsor',
    trackableViaApi: 'manual',
    metricKey: 'sponsorships',
    tiers: [
      { tier: 'default', label: 'Unlocked', threshold: 1 }
    ]
  }
];

export const PROFILE_HIGHLIGHTS = [
  {
    id: 'developer-program',
    name: 'Developer Program Member',
    emoji: '🛠️',
    url: 'https://github.com/developer/register',
    free: true
  },
  {
    id: 'github-pro',
    name: 'GitHub Pro',
    emoji: '💎',
    url: 'https://github.com/pricing',
    free: false
  },
  {
    id: 'campus-expert',
    name: 'GitHub Campus Expert',
    emoji: '🎓',
    url: 'https://education.github.com/experts',
    free: true
  },
  {
    id: 'security-bounty',
    name: 'Security Bug Bounty Hunter',
    emoji: '🛡️',
    url: 'https://bounty.github.com/',
    free: true
  }
];

export const RETIRED_ACHIEVEMENTS = [
  {
    id: 'arctic-code-vault',
    name: 'Arctic Code Vault Contributor',
    emoji: '❄️',
    year: 2020
  },
  {
    id: 'mars-2020',
    name: 'Mars 2020 Helicopter Contributor',
    emoji: '🚁',
    year: 2020
  }
];

/**
 * Finds an active achievement definition by id.
 * @param {string} id
 */
export function getAchievementById(id) {
  return ACHIEVEMENTS_CATALOG.find((item) => item.id === id) || null;
}

/**
 * Computes current tier, next tier, remaining count, and progress percentage.
 * @param {{ tiers: Array<{ tier: string, label: string, threshold: number }> }} achievement
 * @param {number} value
 */
export function computeTierProgress(achievement, value) {
  const safeValue = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
  const tiers = achievement?.tiers || [];

  if (tiers.length === 0) {
    return {
      value: safeValue,
      unlocked: false,
      currentTier: 'locked',
      currentLabel: 'Locked',
      nextTier: null,
      nextLabel: null,
      nextThreshold: null,
      remaining: 0,
      percent: 0,
      isMaxTier: false
    };
  }

  let current = null;
  let next = null;

  for (const tier of tiers) {
    if (safeValue >= tier.threshold) {
      current = tier;
    } else if (!next) {
      next = tier;
    }
  }

  if (!next) {
    return {
      value: safeValue,
      unlocked: true,
      currentTier: current.tier,
      currentLabel: current.label,
      nextTier: null,
      nextLabel: null,
      nextThreshold: current.threshold,
      remaining: 0,
      percent: 100,
      isMaxTier: true
    };
  }

  const floor = current ? current.threshold : 0;
  const span = Math.max(1, next.threshold - floor);
  const gained = Math.max(0, safeValue - floor);
  const percent = Math.min(100, Math.round((gained / span) * 100));

  return {
    value: safeValue,
    unlocked: Boolean(current),
    currentTier: current ? current.tier : 'locked',
    currentLabel: current ? current.label : 'Locked',
    nextTier: next.tier,
    nextLabel: next.label,
    nextThreshold: next.threshold,
    remaining: Math.max(0, next.threshold - safeValue),
    percent,
    isMaxTier: false
  };
}
