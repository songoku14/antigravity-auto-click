const path = require('path');
const vscode = require('vscode');
const { COMMANDS, STATUS_BAR_PRIORITY } = require('./constants');
const { readConfig, updateConfig, inspectConfig, openConfigFile, getContractSummary } = require('./config-service');
const { createDaemonService } = require('./daemon-service');
const { buildFeatureSummary, buildStatusBarState } = require('./status-service');
const { readActivityLog, summarizeActivity } = require('./activity-service');

let extensionState = null;

function activate(context) {
  const outputChannel = vscode.window.createOutputChannel('Antigravity Auto-Click');
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, STATUS_BAR_PRIORITY);
  const daemonService = createDaemonService(outputChannel);
  const extensionConfig = vscode.workspace.getConfiguration('antigravityAutoClick.extension');

  statusBarItem.command = COMMANDS.openControlCenter;
  context.subscriptions.push(outputChannel, statusBarItem);

  extensionState = {
    context,
    daemonService,
    outputChannel,
    statusBarItem
  };

  registerCommands(context);
  if (extensionConfig.get('showConfigWarningsOnStartup', true)) {
    logContractAndWarnings(outputChannel);
  }
  refreshStatusBar();

  statusBarItem.show();

  if (extensionConfig.get('autoStartDaemon', true)) {
    daemonService.start();
    refreshStatusBar();
  }
}

function registerCommands(context) {
  const commandHandlers = [
    [COMMANDS.openControlCenter, openControlCenter],
    [COMMANDS.startDaemon, startDaemon],
    [COMMANDS.stopDaemon, stopDaemon],
    [COMMANDS.reloadDaemon, reloadDaemon],
    [COMMANDS.toggleAutoRetry, toggleAutoRetry],
    [COMMANDS.toggleAutoAccept, toggleAutoAccept],
    [COMMANDS.openConfig, openConfig],
    [COMMANDS.openLogs, openLogs],
    [COMMANDS.showActivitySummary, showActivitySummary]
  ];
  const legacyCommandHandlers = [
    ['antigravity-auto-retry.showMenu', openControlCenter],
    ['antigravity-auto-retry.start', startDaemon],
    ['antigravity-auto-retry.stop', stopDaemon],
    ['antigravity-auto-retry.editConfig', openConfig]
  ];

  for (const [command, handler] of [...commandHandlers, ...legacyCommandHandlers]) {
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));
  }
}

function logContractAndWarnings(outputChannel) {
  const inspection = inspectConfig();
  outputChannel.appendLine('[Extension] Contract summary loaded.');
  outputChannel.appendLine(JSON.stringify(getContractSummary(), null, 2));

  for (const warning of inspection.warnings) {
    outputChannel.appendLine(`[Config Warning] ${warning}`);
  }
}

function refreshStatusBar() {
  if (!extensionState) return;

  const { daemonService, statusBarItem } = extensionState;
  const config = readConfig();
  const status = buildStatusBarState({
    config,
    daemonState: daemonService.getState()
  });

  statusBarItem.text = status.text;
  statusBarItem.tooltip = status.tooltip;
}

async function openControlCenter() {
  const config = readConfig();
  const daemonState = extensionState.daemonService.getState();
  const inspection = inspectConfig();
  const activitySummary = summarizeActivity(readActivityLog());
  const featureSummary = buildFeatureSummary(config);

  const items = [
    {
      label: `Daemon: ${daemonState.running ? 'Running' : 'Stopped'}`,
      description: `Features: ${featureSummary}`,
      detail: `Warnings: ${inspection.warnings.length} | Activity entries: ${activitySummary.total}`
    },
    {
      label: 'Open Raw Config',
      description: 'Inspect normalized config file',
      action: openConfig
    },
    {
      label: daemonState.running ? 'Stop Daemon' : 'Start Daemon',
      description: daemonState.running ? 'Stop background automation process' : 'Start background automation process',
      action: daemonState.running ? stopDaemon : startDaemon
    },
    {
      label: 'Reload Daemon',
      description: 'Restart process with latest config',
      action: reloadDaemon
    },
    {
      label: 'Show Activity Summary',
      description: 'View current activity counters from log',
      action: showActivitySummary
    },
    {
      label: 'Open Logs',
      description: 'Open daemon log file',
      action: openLogs
    }
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Antigravity Control Center (Phase 1 bootstrap)'
  });

  if (selected && typeof selected.action === 'function') {
    await selected.action();
  }
}

function startDaemon() {
  extensionState.daemonService.start();
  refreshStatusBar();
  return vscode.window.showInformationMessage('Antigravity Auto-Click started.');
}

async function stopDaemon() {
  await extensionState.daemonService.stop();
  refreshStatusBar();
  return vscode.window.showInformationMessage('Antigravity Auto-Click stopped.');
}

async function reloadDaemon() {
  await extensionState.daemonService.reload();
  refreshStatusBar();
  return vscode.window.showInformationMessage('Antigravity Auto-Click reloaded.');
}

function toggleAutoRetry() {
  const updated = updateConfig((config) => {
    config.autoRetry.enabled = config.autoRetry.enabled === false;
    return config;
  });

  refreshStatusBar();
  return vscode.window.showInformationMessage(`Auto Retry is now ${updated.autoRetry.enabled ? 'ENABLED' : 'DISABLED'}.`);
}

function toggleAutoAccept() {
  const updated = updateConfig((config) => {
    config.autoAccept.enabled = config.autoAccept.enabled === false;
    return config;
  });

  refreshStatusBar();
  return vscode.window.showInformationMessage(`Auto Accept is now ${updated.autoAccept.enabled ? 'ENABLED' : 'DISABLED'}.`);
}

function openConfig() {
  return openConfigFile();
}

async function openLogs() {
  const logPath = path.join(__dirname, '..', '..', 'logs', 'daemon.log');
  const uri = vscode.Uri.file(logPath);
  try {
    return await vscode.window.showTextDocument(uri);
  } catch (error) {
    return vscode.window.showWarningMessage(`Không thể mở log file: ${error.message}`);
  }
}

function showActivitySummary() {
  const summary = summarizeActivity(readActivityLog());
  return vscode.window.showInformationMessage(
    `Activity: total=${summary.total}, retry=${summary.retryClicks}, accept=${summary.acceptClicks}.`
  );
}

function deactivate() {
  if (!extensionState) return;
  extensionState.daemonService.dispose();
  extensionState = null;
}

module.exports = {
  activate,
  deactivate
};
