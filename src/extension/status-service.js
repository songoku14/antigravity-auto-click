const { isAutoAcceptEnabled, isAutoRetryEnabled } = require('../core/config-schema');
const { CANONICAL_AUTO_ACCEPT_CATEGORIES } = require('./config-contract');

const CATEGORY_BADGES = {
  terminal: 't',
  reviewChange: 'r',
  systemReview: 's'
};

function buildFeatureSummary(config) {
  const activeFeatures = [];

  if (isAutoRetryEnabled(config)) activeFeatures.push('R');

  if (isAutoAcceptEnabled(config)) {
    const activeCategories = [];
    const categories = config.autoAccept.categories || {};
    for (const categoryName of CANONICAL_AUTO_ACCEPT_CATEGORIES) {
      if (categories[categoryName] && categories[categoryName].enabled !== false) {
        activeCategories.push(CATEGORY_BADGES[categoryName]);
      }
    }

    activeFeatures.push(activeCategories.length > 0 ? `A:${activeCategories.join(',')}` : 'A');
  }

  return activeFeatures.length > 0 ? activeFeatures.join(' / ') : 'OFF';
}

function buildStatusBarState({ config, daemonState, activitySummary }) {
  const running = !!(daemonState && daemonState.running);
  const status = daemonState ? daemonState.status.toUpperCase() : 'STOPPED';
  
  let icon = '$(circle-slash)';
  if (status === 'RUNNING') icon = '$(check)';
  else if (status === 'STARTING' || status === 'RELOADING') icon = '$(sync~spin)';
  else if (status === 'STOPPING') icon = '$(loading~spin)';

  const summary = buildFeatureSummary(config);

  let tooltip = `Antigravity Auto-Click: ${status}\nFeatures: ${summary}`;
  if (activitySummary && activitySummary.total > 0) {
    tooltip += `\nRecent Activity: ${activitySummary.retryClicks} retries, ${activitySummary.acceptClicks} accepts`;
  }

  return {
    text: `${icon} AG Auto ${running ? summary : ''}`.trim(),
    tooltip
  };
}

module.exports = {
  buildFeatureSummary,
  buildStatusBarState
};
