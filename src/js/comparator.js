/**
 * Side-by-side GitHub profile achievements comparison engine.
 */

function getAchievementTierLabel(analysis, achievementId) {
  const item = analysis?.achievements?.find((a) => a.id === achievementId);
  if (!item?.progress?.unlocked) return 'Locked';
  return item.progress.currentLabel || 'Default';
}

function resolveWinner(leftVal, rightVal) {
  if (leftVal > rightVal) return 'left';
  if (rightVal > leftVal) return 'right';
  return 'tie';
}

/**
 * Compares two analyzed GitHub profiles across key achievement & activity metrics.
 * @param {object} leftAnalysis
 * @param {object} rightAnalysis
 */
export function compareProfiles(leftAnalysis, rightAnalysis) {
  if (!leftAnalysis || !rightAnalysis) {
    throw new Error('Both profile analyses are required for comparison.');
  }

  const metricsSpec = [
    {
      key: 'mergedPullRequests',
      leftValue: Number(leftAnalysis.metrics?.mergedPullRequests || 0),
      rightValue: Number(rightAnalysis.metrics?.mergedPullRequests || 0),
    },
    {
      key: 'maxRepoStars',
      leftValue: Number(leftAnalysis.metrics?.maxRepoStars || 0),
      rightValue: Number(rightAnalysis.metrics?.maxRepoStars || 0),
    },
    {
      key: 'totalStars',
      leftValue: Number(leftAnalysis.metrics?.totalStars || 0),
      rightValue: Number(rightAnalysis.metrics?.totalStars || 0),
    },
    {
      key: 'unlockedCount',
      leftValue: Number(leftAnalysis.summary?.unlockedCount || 0),
      rightValue: Number(rightAnalysis.summary?.unlockedCount || 0),
    },
    {
      key: 'followers',
      leftValue: Number(leftAnalysis.profile?.followers || 0),
      rightValue: Number(rightAnalysis.profile?.followers || 0),
    },
  ];

  let leftWins = 0;
  let rightWins = 0;
  let ties = 0;

  const rows = metricsSpec.map((item) => {
    const winner = resolveWinner(item.leftValue, item.rightValue);
    if (winner === 'left') leftWins += 1;
    else if (winner === 'right') rightWins += 1;
    else ties += 1;

    return {
      ...item,
      winner,
      diff: item.leftValue - item.rightValue,
    };
  });

  return {
    left: {
      login: leftAnalysis.profile?.login || '',
      name: leftAnalysis.profile?.name || leftAnalysis.profile?.login || '',
      avatarUrl: leftAnalysis.profile?.avatarUrl || '',
      pullSharkTier: getAchievementTierLabel(leftAnalysis, 'pull-shark'),
      starstruckTier: getAchievementTierLabel(leftAnalysis, 'starstruck'),
    },
    right: {
      login: rightAnalysis.profile?.login || '',
      name: rightAnalysis.profile?.name || rightAnalysis.profile?.login || '',
      avatarUrl: rightAnalysis.profile?.avatarUrl || '',
      pullSharkTier: getAchievementTierLabel(rightAnalysis, 'pull-shark'),
      starstruckTier: getAchievementTierLabel(rightAnalysis, 'starstruck'),
    },
    rows,
    score: { leftWins, rightWins, ties },
  };
}
