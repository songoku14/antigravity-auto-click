const COMMANDS = {
  openControlCenter: 'antigravity-auto-click.openControlCenter',
  startDaemon: 'antigravity-auto-click.startDaemon',
  stopDaemon: 'antigravity-auto-click.stopDaemon',
  reloadDaemon: 'antigravity-auto-click.reloadDaemon',
  toggleAutoRetry: 'antigravity-auto-click.toggleAutoRetry',
  toggleAutoAccept: 'antigravity-auto-click.toggleAutoAccept',
  openConfig: 'antigravity-auto-click.openConfig',
  openLogs: 'antigravity-auto-click.openLogs',
  showActivitySummary: 'antigravity-auto-click.showActivitySummary',
  showDiagnostics: 'antigravity-auto-click.showDiagnostics',
  openAutoRetrySettings: 'antigravity-auto-click.openAutoRetrySettings',
  openAutoAcceptSettings: 'antigravity-auto-click.openAutoAcceptSettings'
};

const STATUS_BAR_PRIORITY = 100;

const VIEW_ID = 'antigravity-auto-click.controlCenter';

const MESSAGE_TYPES = {
  TOGGLE_FEATURE: 'TOGGLE_FEATURE',
  UPDATE_BLACKLIST: 'UPDATE_BLACKLIST',
  UPDATE_STATE: 'UPDATE_STATE',
  OPEN_CONFIG: 'OPEN_CONFIG',
  RESET_STATS: 'RESET_STATS',
  ENABLE_CDP: 'ENABLE_CDP'
};

module.exports = {
  COMMANDS,
  STATUS_BAR_PRIORITY,
  VIEW_ID,
  MESSAGE_TYPES
};
