const os = require('os');
const path = require('path');

const STORAGE_ENV_VAR = 'ANTIGRAVITY_AUTO_CLICK_HOME';
const CONFIG_FILE = 'config.json';
const LOGS_DIR_NAME = 'logs';
const ACTIVITY_FILE = 'activity-log.json';
const DAEMON_LOG_FILE = 'daemon.log';

function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function getDefaultStorageDir() {
  const override = process.env[STORAGE_ENV_VAR];
  if (override) return path.resolve(override);

  const homeDir = getHomeDir();

  if (process.platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Antigravity', 'Auto Click');
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, 'Antigravity', 'Auto Click');
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  return path.join(xdgConfigHome, 'antigravity', 'auto-click');
}

function getStoragePaths(storageDir = getDefaultStorageDir()) {
  const root = path.resolve(storageDir);
  const logsDir = path.join(root, LOGS_DIR_NAME);

  return {
    storageDir: root,
    configPath: path.join(root, CONFIG_FILE),
    logsDir,
    activityLogPath: path.join(logsDir, ACTIVITY_FILE),
    daemonLogPath: path.join(logsDir, DAEMON_LOG_FILE)
  };
}

function getLegacyStorageDirs(extraDirs = []) {
  const homeDir = getHomeDir();
  const candidates = [];

  for (const dir of extraDirs) {
    if (dir) candidates.push(path.resolve(dir));
  }

  candidates.push(path.join(__dirname, '..', '..'));

  if (process.platform === 'darwin') {
    candidates.push(
      path.join(
        homeDir,
        'Library',
        'Application Support',
        'Code',
        'User',
        'globalStorage',
        'antigravity.antigravity-auto-click'
      )
    );
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    candidates.push(
      path.join(appData, 'Code', 'User', 'globalStorage', 'antigravity.antigravity-auto-click')
    );
  } else {
    candidates.push(
      path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'antigravity.antigravity-auto-click')
    );
  }

  const canonicalDir = getStoragePaths().storageDir;
  return [...new Set(candidates.map((dir) => path.resolve(dir)))].filter((dir) => dir !== canonicalDir);
}

function getLegacyConfigPaths(extraDirs = []) {
  return getLegacyStorageDirs(extraDirs).map((dir) => path.join(dir, CONFIG_FILE));
}

function getLegacyActivityLogPaths(extraDirs = []) {
  return getLegacyStorageDirs(extraDirs).flatMap((dir) => ([
    path.join(dir, LOGS_DIR_NAME, ACTIVITY_FILE),
    path.join(dir, ACTIVITY_FILE)
  ]));
}

module.exports = {
  ACTIVITY_FILE,
  CONFIG_FILE,
  DAEMON_LOG_FILE,
  LOGS_DIR_NAME,
  STORAGE_ENV_VAR,
  getDefaultStorageDir,
  getLegacyActivityLogPaths,
  getLegacyConfigPaths,
  getLegacyStorageDirs,
  getStoragePaths
};
