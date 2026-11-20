/**
 * Pull Shark daily pace & milestone roadmap calculator.
 */

export const PULL_SHARK_MILESTONES = [
  { key: 'default', label: 'Default', target: 2 },
  { key: 'bronze', label: 'Bronze (x2)', target: 16 },
  { key: 'silver', label: 'Silver (x3)', target: 128 },
  { key: 'gold', label: 'Gold (x4)', target: 1024 },
];

/**
 * Computes remaining PRs, days needed, and estimated completion dates for each Pull Shark tier.
 * @param {number} currentPrs
 * @param {number} prsPerDay
 * @param {Date} [referenceDate]
 */
export function calculatePullSharkRoadmap(currentPrs, prsPerDay, referenceDate = new Date()) {
  const safeCurrent = Number.isFinite(currentPrs) && currentPrs > 0 ? Math.floor(currentPrs) : 0;
  const safePace = Number.isFinite(prsPerDay) && prsPerDay > 0 ? prsPerDay : 1;
  const baseUtcMs = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );

  return PULL_SHARK_MILESTONES.map((tier) => {
    const remaining = Math.max(0, tier.target - safeCurrent);
    const reached = remaining === 0;
    const daysNeeded = reached ? 0 : Math.ceil(remaining / safePace);
    const targetDate = new Date(baseUtcMs + daysNeeded * 86_400_000);
    const estimatedDateIso = targetDate.toISOString().slice(0, 10);

    return {
      ...tier,
      current: safeCurrent,
      remaining,
      reached,
      daysNeeded,
      estimatedDateIso,
    };
  });
}

/**
 * Formats an ISO YYYY-MM-DD date string for Portuguese or English UI display.
 * @param {string} isoDate
 * @param {'pt'|'en'} [lang]
 */
export function formatEstimatedDate(isoDate, lang = 'pt') {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  const locale = lang === 'en' ? 'en-US' : 'pt-BR';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
