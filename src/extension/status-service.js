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

function buildStatusBarState({ config, daemonState }) {
  const running = !!(daemonState && daemonState.running);
  const icon = running ? '$(check)' : '$(circle-slash)';
  const summary = buildFeatureSummary(config);
  const status = running ? 'RUNNING' : 'STOPPED';

  return {
    text: `${icon} AG Auto ${running ? summary : ''}`.trim(),
    tooltip: `Antigravity Auto-Click: ${status} | ${summary}`
  };
}

module.exports = {
  buildFeatureSummary,
  buildStatusBarState
};
