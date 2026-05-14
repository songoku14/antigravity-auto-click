const fs = require('fs');
const path = require('path');
const {
  DEFAULT_CONFIG,
  normalizeConfig,
  normalizeCategoryName
} = require('../core/config-schema');
const { CANONICAL_AUTO_ACCEPT_CATEGORIES, FIELD_DEFINITIONS } = require('./config-contract');

const CONFIG_FILE = 'config.json';

function getProjectRoot() {
  return path.join(__dirname, '..', '..');
}

function getConfigPath() {
  return path.join(getProjectRoot(), CONFIG_FILE);
}

function loadRawConfigResult() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { config: {}, error: null };
  }

  try {
    const rawText = fs.readFileSync(configPath, 'utf8');
    if (!rawText.trim()) {
      return { config: {}, error: null };
    }

    return {
      config: JSON.parse(rawText),
      error: null
    };
  } catch (error) {
    return {
      config: {},
      error
    };
  }
}

function readRawConfig() {
  return loadRawConfigResult().config;
}

function normalizeForSave(rawConfig) {
  return normalizeConfig(rawConfig || DEFAULT_CONFIG);
}

function readConfig() {
  return normalizeForSave(readRawConfig());
}

function writeConfig(config) {
  const configPath = getConfigPath();
  const normalized = normalizeForSave(config);
  fs.writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function updateConfig(mutator) {
  const currentConfig = readConfig();
  const updatedConfig = mutator(structuredClone(currentConfig));
  if (!updatedConfig || typeof updatedConfig !== 'object') {
    throw new Error('Config mutator must return an object.');
  }

  return writeConfig(updatedConfig);
}

function inspectConfig() {
  const loadResult = loadRawConfigResult();
  const rawConfig = loadResult.config;
  const normalized = normalizeForSave(rawConfig);
  const warnings = [];
  const rawCategories = rawConfig && rawConfig.autoAccept && typeof rawConfig.autoAccept === 'object'
    ? rawConfig.autoAccept.categories || {}
    : {};

  if (loadResult.error) {
    warnings.push(`Invalid config JSON detected. Extension fell back to normalized defaults: ${loadResult.error.message}`);
  }

  for (const rawName of Object.keys(rawCategories)) {
    const canonicalName = normalizeCategoryName(rawName);
    if (rawName !== canonicalName) {
      warnings.push(`Legacy category "${rawName}" will be normalized to "${canonicalName}".`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawConfig, 'performClickAutoAccept')) {
    warnings.push('Legacy key "performClickAutoAccept" will be normalized to "autoAccept.performClick".');
  }

  if (Array.isArray(rawConfig.blacklist)) {
    warnings.push('Legacy key "blacklist" will be normalized to "autoAccept.blacklist".');
  }

  const legacyRetryTimingKeys = ['pollInterval', 'clickDelay', 'minClickInterval', 'maxRetriesPerMinute', 'cooldownMs'];
  for (const key of legacyRetryTimingKeys) {
    if (Object.prototype.hasOwnProperty.call(rawConfig, key)) {
      warnings.push(`Legacy key "${key}" will be normalized into nested autoRetry timing/rateLimit fields.`);
    }
  }

  for (const categoryName of CANONICAL_AUTO_ACCEPT_CATEGORIES) {
    const category = normalized.autoAccept.categories[categoryName];
    if (!category) {
      warnings.push(`Missing category "${categoryName}" was restored from defaults.`);
    }
  }

  return {
    rawConfig,
    normalized,
    warnings
  };
}

function getContractSummary() {
  return FIELD_DEFINITIONS.map((field) => ({
    path: field.path,
    type: field.type,
    surface: field.surface,
    requiresReload: field.requiresReload
  }));
}

async function openConfigFile() {
  const vscode = require('vscode');
  const uri = vscode.Uri.file(getConfigPath());
  return vscode.window.showTextDocument(uri);
}

module.exports = {
  getConfigPath,
  getContractSummary,
  inspectConfig,
  openConfigFile,
  readConfig,
  writeConfig,
  updateConfig
};
