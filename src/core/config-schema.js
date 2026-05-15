const DEFAULT_DIALOG_CONTAINER_SELECTORS = [
  '.antigravity-mock-dialog',
  '.monaco-dialog-box',
  '.dialog-shadow',
  '.notifications-toasts',
  '.notification-toast-container',
  '.notification-list-item',
  '.notification-toast',
  '.notifications-center',
  '.jetski-error',
  '.error-overlay',
  '.test-dialog',
  '.test-accept-dialog',
  '.bg-agent-convo-background',
  '.antigravity-agent-side-panel',
  '#antigravity\\.agentSidePanelInputBox',
  '[role="dialog"]',
  '[role="alertdialog"]'
];

const DEFAULT_RETRY_ERROR_PATTERNS = [
  /high\s*traffic/i,
  /server\s*(is\s*)?busy/i,
  /too\s*many\s*requests/i,
  /rate\s*limit(ed)?/i,
  /overloaded/i,
  /temporarily\s*unavailable/i,
  /service\s*unavailable/i,
  /request\s*failed/i,
  /something\s*went\s*wrong/i,
  /agent\s*terminated/i,
  /try\s*again/i
];

const DEFAULT_RETRY_BUTTON_PATTERNS = [
  /^retry$/i,
  /^try\s*again$/i,
  /^thử\s*lại$/i,
  /^reconnect$/i
];

const DEFAULT_RETRY_CONTEXT_PATTERNS = [
  /high\s*traffic/i,
  /server\s*(is\s*)?busy/i,
  /too\s*many\s*requests/i,
  /rate\s*limit(ed)?/i,
  /overloaded/i,
  /unavailable/i,
  /request\s*failed/i,
  /something\s*went\s*wrong/i,
  /agent\s*terminated/i,
  /try\s*again/i,
  /connection\s*lost/i
];

const DEFAULT_BLACKLIST = [
  'rm ',
  'sudo ',
  'force ',
  'push ',
  'delete ',
  'terminate ',
  'pkill ',
  'kill ',
  'mkfs'
];

const DEFAULT_ACTION_CATEGORIES = {
  terminal: {
    enabled: true,
    buttons: [/^run$/i, /^run⌥enter$/i, /^execute$/i],
    context: [
      /allow\s*the\s*following\s*command/i,
      /run\s*this\s*command/i,
      /run\s*the\s*command/i,
      /execute\s*the\s*following/i,
      /do\s*you\s*want\s*to\s*run/i,
      /terminal\s*action/i,
      /thực\s*thi\s*lệnh/i,
      /chạy\s*lệnh/i
    ]
  },
  reviewChange: {
    enabled: true,
    buttons: [/^proceed$/i, /^accept\s*all$/i],
    context: [
      /review\s*the\s*changes/i,
      /agent\s*prompt/i,
      /approve\s*request/i,
      /review\s*required/i,
      /proceed\s*with\s*changes/i
    ]
  },
  systemReview: {
    enabled: true,
    buttons: [],
    context: []
  }
};

const CANONICAL_AUTO_ACCEPT_CATEGORIES = [
  'terminal',
  'reviewChange',
  'systemReview'
];

const AUTO_ACCEPT_CATEGORY_ALIASES = {
  review: 'reviewChange',
  system: 'systemReview'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function regexToString(value) {
  if (value instanceof RegExp) return value.toString();
  return String(value);
}

function normalizePatternList(value, fallback) {
  if (!Array.isArray(value)) return fallback.map(regexToString);
  return value
    .map((entry) => {
      if (entry == null) return null;
      return regexToString(entry);
    })
    .filter(Boolean);
}

function normalizeBoolean(value, fallback) {
  if (value === true || value === false) return value;
  return fallback;
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeCategoryName(name) {
  if (!name) return '';
  return AUTO_ACCEPT_CATEGORY_ALIASES[name] || name;
}

function mergeUniqueStrings(primary, secondary) {
  const result = [];
  for (const entry of [...primary, ...secondary]) {
    if (entry == null) continue;
    const value = regexToString(entry);
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

function mergeCategorySources(primaryCategory, secondaryCategory) {
  const primary = ensureObject(primaryCategory);
  const secondary = ensureObject(secondaryCategory);

  return {
    ...secondary,
    ...primary,
    buttons: mergeUniqueStrings(
      Array.isArray(primary.buttons) ? primary.buttons : [],
      Array.isArray(secondary.buttons) ? secondary.buttons : []
    ),
    context: mergeUniqueStrings(
      Array.isArray(primary.context) ? primary.context : (Array.isArray(primary.patterns) ? primary.patterns : []),
      Array.isArray(secondary.context) ? secondary.context : (Array.isArray(secondary.patterns) ? secondary.patterns : [])
    )
  };
}

function normalizeRawCategories(rawCategories) {
  const source = ensureObject(rawCategories);
  const normalized = {};

  for (const [rawName, rawCategory] of Object.entries(source)) {
    const normalizedName = normalizeCategoryName(rawName);
    if (!normalizedName) continue;

    if (!normalized[normalizedName]) {
      normalized[normalizedName] = ensureObject(rawCategory);
      continue;
    }

    normalized[normalizedName] = mergeCategorySources(
      normalized[normalizedName],
      rawCategory
    );
  }

  return normalized;
}

function normalizeCategoryConfig(categoryName, rawCategory, fallbackCategory) {
  const source = ensureObject(rawCategory);
  const fallback = ensureObject(fallbackCategory);
  const legacyPatterns = Array.isArray(source.patterns) ? source.patterns : null;

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled !== false),
    buttons: normalizePatternList(source.buttons, fallback.buttons || []),
    context: normalizePatternList(source.context || legacyPatterns, fallback.context || [])
  };
}

function buildDefaultConfig() {
  const categories = {};
  for (const [name, category] of Object.entries(DEFAULT_ACTION_CATEGORIES)) {
    categories[name] = normalizeCategoryConfig(name, category, category);
  }

  return {
    debug: true,
    autoRetry: {
      enabled: true,
      dialogContainerSelectors: [...DEFAULT_DIALOG_CONTAINER_SELECTORS],
      errorPatterns: normalizePatternList(DEFAULT_RETRY_ERROR_PATTERNS, DEFAULT_RETRY_ERROR_PATTERNS),
      retryButtonPatterns: normalizePatternList(DEFAULT_RETRY_BUTTON_PATTERNS, DEFAULT_RETRY_BUTTON_PATTERNS),
      retryContextPatterns: normalizePatternList(DEFAULT_RETRY_CONTEXT_PATTERNS, DEFAULT_RETRY_CONTEXT_PATTERNS),
      customRetryPatterns: [],
      timing: {
        pollInterval: 3000,
        clickDelay: 800,
        minClickInterval: 5000
      },
      rateLimit: {
        maxRetriesPerMinute: 15,
        cooldownMs: 60000
      }
    },
    autoAccept: {
      enabled: false,
      performClick: true,
      blacklist: [...DEFAULT_BLACKLIST],
      customAcceptPatterns: [],
      categories
    }
  };
}

const DEFAULT_CONFIG = buildDefaultConfig();

function normalizeConfig(rawConfig = {}) {
  const raw = ensureObject(rawConfig);
  const defaults = buildDefaultConfig();

  const legacyAutoRetry = raw.autoRetry;
  const legacyAutoAccept = raw.autoAccept;

  const autoRetrySource = typeof legacyAutoRetry === 'object' && legacyAutoRetry !== null && !Array.isArray(legacyAutoRetry)
    ? legacyAutoRetry
    : {};
  const autoAcceptSource = typeof legacyAutoAccept === 'object' && legacyAutoAccept !== null && !Array.isArray(legacyAutoAccept)
    ? legacyAutoAccept
    : {};

  const normalized = clone(defaults);

  normalized.debug = normalizeBoolean(raw.debug, defaults.debug);

  normalized.autoRetry.enabled = typeof legacyAutoRetry === 'boolean'
    ? legacyAutoRetry
    : normalizeBoolean(autoRetrySource.enabled, defaults.autoRetry.enabled);
  normalized.autoRetry.dialogContainerSelectors = Array.isArray(autoRetrySource.dialogContainerSelectors)
    ? autoRetrySource.dialogContainerSelectors.slice()
    : defaults.autoRetry.dialogContainerSelectors.slice();
  normalized.autoRetry.errorPatterns = normalizePatternList(
    autoRetrySource.errorPatterns,
    defaults.autoRetry.errorPatterns
  );
  normalized.autoRetry.retryButtonPatterns = normalizePatternList(
    autoRetrySource.retryButtonPatterns,
    defaults.autoRetry.retryButtonPatterns
  );
  normalized.autoRetry.retryContextPatterns = normalizePatternList(
    autoRetrySource.retryContextPatterns,
    defaults.autoRetry.retryContextPatterns
  );
  normalized.autoRetry.customRetryPatterns = normalizePatternList(
    autoRetrySource.customRetryPatterns || raw.customRetryPatterns,
    []
  );

  const retryTiming = ensureObject(autoRetrySource.timing);
  normalized.autoRetry.timing.pollInterval = normalizeNumber(
    retryTiming.pollInterval ?? raw.pollInterval,
    defaults.autoRetry.timing.pollInterval
  );
  normalized.autoRetry.timing.clickDelay = normalizeNumber(
    retryTiming.clickDelay ?? raw.clickDelay,
    defaults.autoRetry.timing.clickDelay
  );
  normalized.autoRetry.timing.minClickInterval = normalizeNumber(
    retryTiming.minClickInterval ?? raw.minClickInterval,
    defaults.autoRetry.timing.minClickInterval
  );

  const retryRateLimit = ensureObject(autoRetrySource.rateLimit);
  normalized.autoRetry.rateLimit.maxRetriesPerMinute = normalizeNumber(
    retryRateLimit.maxRetriesPerMinute ?? raw.maxRetriesPerMinute,
    defaults.autoRetry.rateLimit.maxRetriesPerMinute
  );
  normalized.autoRetry.rateLimit.cooldownMs = normalizeNumber(
    retryRateLimit.cooldownMs ?? raw.cooldownMs,
    defaults.autoRetry.rateLimit.cooldownMs
  );

  normalized.autoAccept.enabled = typeof legacyAutoAccept === 'boolean'
    ? legacyAutoAccept
    : normalizeBoolean(autoAcceptSource.enabled, defaults.autoAccept.enabled);
  normalized.autoAccept.performClick = normalizeBoolean(
    autoAcceptSource.performClick ?? raw.performClickAutoAccept,
    defaults.autoAccept.performClick
  );
  normalized.autoAccept.blacklist = Array.isArray(autoAcceptSource.blacklist)
    ? autoAcceptSource.blacklist.slice()
    : (Array.isArray(raw.blacklist) ? raw.blacklist.slice() : defaults.autoAccept.blacklist.slice());
  normalized.autoAccept.customAcceptPatterns = normalizePatternList(
    autoAcceptSource.customAcceptPatterns || raw.customAcceptPatterns,
    []
  );

  const rawCategories = normalizeRawCategories(autoAcceptSource.categories);
  for (const [name, fallbackCategory] of Object.entries(defaults.autoAccept.categories)) {
    normalized.autoAccept.categories[name] = normalizeCategoryConfig(name, rawCategories[name], fallbackCategory);
  }

  for (const [name, rawCategory] of Object.entries(rawCategories)) {
    if (normalized.autoAccept.categories[name]) continue;
    normalized.autoAccept.categories[name] = normalizeCategoryConfig(name, rawCategory, {
      enabled: true,
      buttons: [],
      context: []
    });
  }

  return normalized;
}

function isAutoRetryEnabled(config) {
  return normalizeConfig(config).autoRetry.enabled !== false;
}

function isAutoAcceptEnabled(config) {
  return normalizeConfig(config).autoAccept.enabled !== false;
}

module.exports = {
  AUTO_ACCEPT_CATEGORY_ALIASES,
  CANONICAL_AUTO_ACCEPT_CATEGORIES,
  DEFAULT_CONFIG,
  normalizeCategoryName,
  normalizeConfig,
  isAutoRetryEnabled,
  isAutoAcceptEnabled
};
