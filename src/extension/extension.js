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
  const activitySummary = summarizeActivity(readActivityLog());
  
  const status = buildStatusBarState({
    config,
    daemonState: daemonService.getState(),
    activitySummary
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
      label: `$(info) Status: ${daemonState.running ? 'Running' : 'Stopped'}`,
      description: `Features: ${featureSummary}`,
      detail: `Warnings: ${inspection.warnings.length} | Total activity: ${activitySummary.total}`,
      alwaysShow: true
    },
    {
      label: '--- Actions ---',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: daemonState.running ? '$(stop-circle) Stop Daemon' : '$(play-circle) Start Daemon',
      description: daemonState.running ? 'Stop background automation process' : 'Start background automation process',
      action: daemonState.running ? stopDaemon : startDaemon
    },
    {
      label: '$(refresh) Reload Daemon',
      description: 'Restart process with latest config',
      action: reloadDaemon
    },
    {
      label: '--- Quick Toggles ---',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: `${config.autoRetry.enabled ? '$(check)' : '$(circle-slash)'} Auto Retry`,
      description: config.autoRetry.enabled ? 'Enabled' : 'Disabled',
      action: toggleAutoRetry
    },
    {
      label: `${config.autoAccept.enabled ? '$(check)' : '$(circle-slash)'} Auto Accept`,
      description: config.autoAccept.enabled ? 'Enabled' : 'Disabled',
      action: toggleAutoAccept
    },
    {
      label: '--- Diagnostics & Config ---',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: '$(graph) Show Activity Summary',
      description: 'View current activity counters from log',
      action: showActivitySummary
    },
    {
      label: '$(output) Open Logs',
      description: 'Open daemon log file',
      action: openLogs
    },
    {
      label: '$(settings-gear) Open Raw Config',
      description: 'Inspect normalized config file',
      action: openConfig
    }
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Antigravity Control Center'
  });

  if (selected && typeof selected.action === 'function') {
    await selected.action();
    // After action, re-open control center to show updated state
    if (selected.label.includes('Toggle') || selected.label.includes('Daemon')) {
      await openControlCenter();
    }
  }
}

function startDaemon() {
  extensionState.daemonService.start();
  refreshStatusBar();
  vscode.window.setStatusBarMessage('Antigravity Auto-Click started', 3000);
}

async function stopDaemon() {
  await extensionState.daemonService.stop();
  refreshStatusBar();
  vscode.window.setStatusBarMessage('Antigravity Auto-Click stopped', 3000);
}

async function reloadDaemon() {
  await extensionState.daemonService.reload();
  refreshStatusBar();
  vscode.window.setStatusBarMessage('Antigravity Auto-Click reloaded', 3000);
}

function toggleAutoRetry() {
  const updated = updateConfig((config) => {
    config.autoRetry.enabled = config.autoRetry.enabled === false;
    return config;
  });

  refreshStatusBar();
  vscode.window.setStatusBarMessage(`Auto Retry ${updated.autoRetry.enabled ? 'ENABLED' : 'DISABLED'}`, 3000);
}

function toggleAutoAccept() {
  const updated = updateConfig((config) => {
    config.autoAccept.enabled = config.autoAccept.enabled === false;
    return config;
  });

  refreshStatusBar();
  vscode.window.setStatusBarMessage(`Auto Accept ${updated.autoAccept.enabled ? 'ENABLED' : 'DISABLED'}`, 3000);
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
  const categories = Object.entries(summary.byCategory)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ') || 'none';
  
  const skipReasons = Object.entries(summary.skipReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(', ') || 'none';

  return vscode.window.showInformationMessage(
    `Activity Summary:\n` +
    `- Total Clicks: ${summary.total} (Retry: ${summary.retryClicks}, Accept: ${summary.acceptClicks})\n` +
    `- By Category: ${categories}\n` +
    `- Top Skip Reasons: ${skipReasons}`
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
