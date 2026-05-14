const {
  AUTO_ACCEPT_CATEGORY_ALIASES,
  CANONICAL_AUTO_ACCEPT_CATEGORIES,
  DEFAULT_CONFIG
} = require('../core/config-schema');

const CATEGORY_METADATA = {
  terminal: {
    label: 'Terminal',
    description: 'Tự động chạy terminal prompts an toàn theo blacklist.',
    risk: 'medium'
  },
  reviewChange: {
    label: 'Review Change',
    description: 'Tự động chấp nhận review/approve/proceed cho thay đổi mã.',
    risk: 'medium'
  },
  systemReview: {
    label: 'System Review',
    description: 'Tự động chấp nhận các prompt mức hệ thống hoặc workflow rộng hơn.',
    risk: 'high'
  }
};

const FIELD_DEFINITIONS = [
  {
    path: 'debug',
    label: 'Debug Mode',
    type: 'boolean',
    surface: 'controlCenter',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.debug
  },
  {
    path: 'autoRetry.enabled',
    label: 'Auto Retry',
    type: 'boolean',
    surface: 'controlCenter',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.enabled
  },
  {
    path: 'autoRetry.errorPatterns',
    label: 'Retry Error Patterns',
    type: 'pattern-list',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.errorPatterns
  },
  {
    path: 'autoRetry.retryButtonPatterns',
    label: 'Retry Button Patterns',
    type: 'pattern-list',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.retryButtonPatterns
  },
  {
    path: 'autoRetry.retryContextPatterns',
    label: 'Retry Context Patterns',
    type: 'pattern-list',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.retryContextPatterns
  },
  {
    path: 'autoRetry.customRetryPatterns',
    label: 'Custom Retry Patterns',
    type: 'pattern-list',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.customRetryPatterns
  },
  {
    path: 'autoRetry.timing.pollInterval',
    label: 'Poll Interval',
    type: 'number',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.timing.pollInterval
  },
  {
    path: 'autoRetry.timing.clickDelay',
    label: 'Click Delay',
    type: 'number',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.timing.clickDelay
  },
  {
    path: 'autoRetry.timing.minClickInterval',
    label: 'Min Click Interval',
    type: 'number',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.timing.minClickInterval
  },
  {
    path: 'autoRetry.rateLimit.maxRetriesPerMinute',
    label: 'Max Retries Per Minute',
    type: 'number',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.rateLimit.maxRetriesPerMinute
  },
  {
    path: 'autoRetry.rateLimit.cooldownMs',
    label: 'Retry Cooldown',
    type: 'number',
    surface: 'autoRetry',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoRetry.rateLimit.cooldownMs
  },
  {
    path: 'autoAccept.enabled',
    label: 'Auto Accept',
    type: 'boolean',
    surface: 'controlCenter',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoAccept.enabled
  },
  {
    path: 'autoAccept.performClick',
    label: 'Perform Click',
    type: 'boolean',
    surface: 'autoAccept',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoAccept.performClick
  },
  {
    path: 'autoAccept.blacklist',
    label: 'Terminal Blacklist',
    type: 'string-list',
    surface: 'autoAccept',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoAccept.blacklist
  },
  {
    path: 'autoAccept.customAcceptPatterns',
    label: 'Custom Accept Patterns',
    type: 'pattern-list',
    surface: 'autoAccept',
    requiresReload: false,
    defaultValue: DEFAULT_CONFIG.autoAccept.customAcceptPatterns
  }
];

for (const categoryName of CANONICAL_AUTO_ACCEPT_CATEGORIES) {
  const meta = CATEGORY_METADATA[categoryName];
  FIELD_DEFINITIONS.push(
    {
      path: `autoAccept.categories.${categoryName}.enabled`,
      label: `${meta.label} Enabled`,
      type: 'boolean',
      surface: 'autoAcceptCategory',
      requiresReload: false,
      defaultValue: DEFAULT_CONFIG.autoAccept.categories[categoryName].enabled
    },
    {
      path: `autoAccept.categories.${categoryName}.buttons`,
      label: `${meta.label} Buttons`,
      type: 'pattern-list',
      surface: 'autoAcceptCategory',
      requiresReload: false,
      defaultValue: DEFAULT_CONFIG.autoAccept.categories[categoryName].buttons
    },
    {
      path: `autoAccept.categories.${categoryName}.context`,
      label: `${meta.label} Context`,
      type: 'pattern-list',
      surface: 'autoAcceptCategory',
      requiresReload: false,
      defaultValue: DEFAULT_CONFIG.autoAccept.categories[categoryName].context
    }
  );
}

const MIGRATION_RULES = [
  {
    from: 'autoAccept.categories.review',
    to: 'autoAccept.categories.reviewChange',
    reason: 'Chuẩn hóa tên category review sang reviewChange.'
  },
  {
    from: 'autoAccept.categories.system',
    to: 'autoAccept.categories.systemReview',
    reason: 'Chuẩn hóa tên category system sang systemReview.'
  },
  {
    from: 'autoAccept.categories.*.patterns',
    to: 'autoAccept.categories.*.context',
    reason: 'Legacy key patterns được map vào context để không mất dữ liệu cũ.'
  }
];

module.exports = {
  AUTO_ACCEPT_CATEGORY_ALIASES,
  CANONICAL_AUTO_ACCEPT_CATEGORIES,
  CATEGORY_METADATA,
  FIELD_DEFINITIONS,
  MIGRATION_RULES
};
