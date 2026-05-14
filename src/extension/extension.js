const path = require('path');
const vscode = require('vscode');
const { COMMANDS, STATUS_BAR_PRIORITY } = require('./constants');
const { 
  readConfig, 
  updateConfig, 
  inspectConfig, 
  openConfigFile, 
  getContractSummary,
  validateConfigField,
  resetConfigBlock
} = require('./config-service');
const { createDaemonService } = require('./daemon-service');
const { createDiagnosticsService } = require('./diagnostics-service');
const { buildFeatureSummary, buildStatusBarState } = require('./status-service');
const { readActivityLog, summarizeActivity } = require('./activity-service');

let extensionState = null;

function activate(context) {
  const outputChannel = vscode.window.createOutputChannel('Antigravity Auto-Click');
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, STATUS_BAR_PRIORITY);
  const daemonService = createDaemonService(outputChannel);
  const diagnosticsService = createDiagnosticsService(daemonService);
  const extensionConfig = vscode.workspace.getConfiguration('antigravityAutoClick.extension');

  statusBarItem.command = COMMANDS.openControlCenter;
  context.subscriptions.push(outputChannel, statusBarItem);

  extensionState = {
    context,
    daemonService,
    diagnosticsService,
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
    [COMMANDS.showActivitySummary, showActivitySummary],
    [COMMANDS.showDiagnostics, showDiagnostics],
    [COMMANDS.openAutoRetrySettings, openAutoRetrySettings],
    [COMMANDS.openAutoAcceptSettings, openAutoAcceptSettings]
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
      label: '--- Configuration ---',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: '$(sync) Auto Retry Settings',
      description: `Enabled: ${config.autoRetry.enabled}`,
      action: openAutoRetrySettings
    },
    {
      label: '$(check-all) Auto Accept Settings',
      description: `Enabled: ${config.autoAccept.enabled}`,
      action: () => vscode.commands.executeCommand(COMMANDS.openAutoAcceptSettings)
    },
    {
      label: '--- Quick Toggles ---',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: `${config.autoRetry.enabled ? '$(check)' : '$(circle-slash)'} Toggle Auto Retry`,
      action: toggleAutoRetry
    },
    {
      label: `${config.autoAccept.enabled ? '$(check)' : '$(circle-slash)'} Toggle Auto Accept`,
      action: toggleAutoAccept
    },
    {
      label: '--- Diagnostics ---',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: '$(graph) Show Activity Summary',
      description: 'View current activity counters from log',
      action: showActivitySummary
    },
    {
      label: '$(debug-console) Run System Diagnostics',
      description: 'Check CDP, config, and file health',
      action: showDiagnostics
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
    // After action, re-open control center if it's a toggle
    if (selected.label.includes('Toggle')) {
      await openControlCenter();
    }
  }
}

async function openAutoRetrySettings() {
  const config = readConfig();
  const items = [
    {
      label: `${config.autoRetry.enabled ? '$(check)' : '$(circle-slash)'} Enabled`,
      description: config.autoRetry.enabled ? 'Enabled' : 'Disabled',
      action: toggleAutoRetry
    },
    {
      label: '$(regex) Error Patterns',
      description: config.autoRetry.errorPatterns.join(', '),
      action: () => editPatternList('autoRetry.errorPatterns', 'Error Patterns')
    },
    {
      label: '$(regex) Button Patterns',
      description: config.autoRetry.retryButtonPatterns.join(', '),
      action: () => editPatternList('autoRetry.retryButtonPatterns', 'Button Patterns')
    },
    {
      label: '$(regex) Context Patterns',
      description: config.autoRetry.retryContextPatterns.join(', '),
      action: () => editPatternList('autoRetry.retryContextPatterns', 'Context Patterns')
    },
    {
      label: '$(regex) Custom Patterns',
      description: config.autoRetry.customRetryPatterns.join(', '),
      action: () => editPatternList('autoRetry.customRetryPatterns', 'Custom Patterns')
    },
    {
      label: '$(watch) Timing Settings',
      description: `Poll: ${config.autoRetry.timing.pollInterval}ms, Delay: ${config.autoRetry.timing.clickDelay}ms`,
      action: openAutoRetryTimingSettings
    },
    {
      label: '$(dashboard) Rate Limits',
      description: `Max: ${config.autoRetry.rateLimit.maxRetriesPerMinute}, Cooldown: ${config.autoRetry.rateLimit.cooldownMs}ms`,
      action: openAutoRetryRateSettings
    },
    {
      label: '$(discard) Restore Defaults',
      description: 'Reset all Auto Retry settings to defaults',
      action: async () => {
        const confirm = await vscode.window.showWarningMessage(
          'Are you sure you want to reset Auto Retry settings?',
          { modal: true },
          'Reset'
        );
        if (confirm === 'Reset') {
          resetConfigBlock('autoRetry');
          refreshStatusBar();
          vscode.window.setStatusBarMessage('Auto Retry settings reset to defaults', 3000);
        }
      }
    }
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Auto Retry Settings'
  });

  if (selected && typeof selected.action === 'function') {
    await selected.action();
    if (!selected.label.includes('Restore')) {
      await openAutoRetrySettings();
    }
  } else {
    await openControlCenter();
  }
}

async function openAutoRetryTimingSettings() {
  const config = readConfig();
  const items = [
    {
      label: 'Poll Interval',
      description: `${config.autoRetry.timing.pollInterval}ms`,
      action: () => editNumericField('autoRetry.timing.pollInterval', 'Poll Interval (ms)')
    },
    {
      label: 'Click Delay',
      description: `${config.autoRetry.timing.clickDelay}ms`,
      action: () => editNumericField('autoRetry.timing.clickDelay', 'Click Delay (ms)')
    },
    {
      label: 'Min Click Interval',
      description: `${config.autoRetry.timing.minClickInterval}ms`,
      action: () => editNumericField('autoRetry.timing.minClickInterval', 'Min Click Interval (ms)')
    }
  ];

  const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Auto Retry Timing' });
  if (selected && typeof selected.action === 'function') {
    await selected.action();
    await openAutoRetryTimingSettings();
  } else {
    await openAutoRetrySettings();
  }
}

async function openAutoRetryRateSettings() {
  const config = readConfig();
  const items = [
    {
      label: 'Max Retries Per Minute',
      description: `${config.autoRetry.rateLimit.maxRetriesPerMinute}`,
      action: () => editNumericField('autoRetry.rateLimit.maxRetriesPerMinute', 'Max Retries Per Minute')
    },
    {
      label: 'Cooldown (ms)',
      description: `${config.autoRetry.rateLimit.cooldownMs}ms`,
      action: () => editNumericField('autoRetry.rateLimit.cooldownMs', 'Cooldown (ms)')
    }
  ];

  const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Auto Retry Rate Limits' });
  if (selected && typeof selected.action === 'function') {
    await selected.action();
    await openAutoRetryRateSettings();
  } else {
    await openAutoRetrySettings();
  }
}

async function editNumericField(path, label) {
  const config = readConfig();
  const parts = path.split('.');
  let current = config;
  for (const part of parts) current = current[part];

  const input = await vscode.window.showInputBox({
    prompt: `Enter value for ${label}`,
    value: String(current),
    validateInput: (val) => {
      try {
        validateConfigField(path, val);
        return null;
      } catch (e) {
        return e.message;
      }
    }
  });

  if (input !== undefined) {
    updateConfig((cfg) => {
      let target = cfg;
      for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
      target[parts[parts.length - 1]] = Number(input);
      return cfg;
    });
    refreshStatusBar();
    vscode.window.setStatusBarMessage(`${label} updated to ${input}`, 3000);
  }
}

async function editPatternList(path, label) {
  const config = readConfig();
  const parts = path.split('.');
  let current = config;
  for (const part of parts) current = current[part];

  const input = await vscode.window.showInputBox({
    prompt: `Enter patterns for ${label} (comma separated)`,
    value: current.join(', '),
    validateInput: (val) => {
      const list = val.split(',').map(s => s.trim()).filter(s => s);
      try {
        validateConfigField(path, list);
        return null;
      } catch (e) {
        return e.message;
      }
    }
  });

  if (input !== undefined) {
    const list = input.split(',').map(s => s.trim()).filter(s => s);
    updateConfig((cfg) => {
      let target = cfg;
      for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
      target[parts[parts.length - 1]] = list;
      return cfg;
    });
    refreshStatusBar();
    vscode.window.setStatusBarMessage(`${label} updated`, 3000);
  }
}

async function openAutoAcceptSettings() {
  const { CATEGORY_METADATA } = require('./config-contract');
  const config = readConfig();
  
  const items = [
    {
      label: `${config.autoAccept.enabled ? '$(check)' : '$(circle-slash)'} Enabled`,
      description: config.autoAccept.enabled ? 'Enabled' : 'Disabled',
      action: toggleAutoAccept
    },
    {
      label: `${config.autoAccept.performClick ? '$(zap)' : '$(eye)'} Perform Click`,
      description: config.autoAccept.performClick ? 'ENABLED (Will click buttons)' : 'DISABLED (Observe only)',
      detail: config.autoAccept.performClick ? 'WARNING: High risk of accidental actions.' : '',
      action: async () => {
        if (!config.autoAccept.performClick) {
          const confirm = await vscode.window.showWarningMessage(
            'Bật Perform Click cho phép Antigravity tự động nhấn nút. Bạn có chắc chắn muốn tiếp tục?',
            { modal: true },
            'Enable'
          );
          if (confirm !== 'Enable') return;
        }
        updateConfig((cfg) => {
          cfg.autoAccept.performClick = !cfg.autoAccept.performClick;
          return cfg;
        });
        refreshStatusBar();
      }
    },
    {
      label: '--- Categories ---',
      kind: vscode.QuickPickItemKind.Separator
    }
  ];

  for (const [key, meta] of Object.entries(CATEGORY_METADATA)) {
    const catConfig = config.autoAccept.categories[key] || {};
    items.push({
      label: `${catConfig.enabled ? '$(check)' : '$(circle-slash)'} ${meta.label}`,
      description: meta.description,
      detail: `Enabled: ${catConfig.enabled}, Patterns: ${catConfig.buttons.length + catConfig.context.length}`,
      action: () => openCategorySettings(key)
    });
  }

  items.push(
    {
      label: '--- Advanced ---',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: '$(list-unordered) Terminal Blacklist',
      description: config.autoAccept.blacklist.join(', ') || '(Empty)',
      action: () => editStringList('autoAccept.blacklist', 'Terminal Blacklist')
    },
    {
      label: '$(regex) Custom Accept Patterns',
      description: config.autoAccept.customAcceptPatterns.join(', ') || '(Empty)',
      action: () => editPatternList('autoAccept.customAcceptPatterns', 'Custom Accept Patterns')
    },
    {
      label: '$(discard) Restore Defaults',
      description: 'Reset all Auto Accept settings to defaults',
      action: async () => {
        const confirm = await vscode.window.showWarningMessage(
          'Are you sure you want to reset Auto Accept settings?',
          { modal: true },
          'Reset'
        );
        if (confirm === 'Reset') {
          resetConfigBlock('autoAccept');
          refreshStatusBar();
          vscode.window.setStatusBarMessage('Auto Accept settings reset to defaults', 3000);
        }
      }
    }
  );

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Auto Accept Settings'
  });

  if (selected && typeof selected.action === 'function') {
    await selected.action();
    if (!selected.label.includes('Restore') && !selected.label.includes('Category')) {
      await openAutoAcceptSettings();
    }
  } else {
    await openControlCenter();
  }
}

async function openCategorySettings(categoryName) {
  const { CATEGORY_METADATA } = require('./config-contract');
  const meta = CATEGORY_METADATA[categoryName];
  const config = readConfig();
  const catConfig = config.autoAccept.categories[categoryName];

  const items = [
    {
      label: `${catConfig.enabled ? '$(check)' : '$(circle-slash)'} Enabled`,
      description: catConfig.enabled ? 'Enabled' : 'Disabled',
      action: async () => {
        if (!catConfig.enabled && categoryName === 'systemReview') {
          const confirm = await vscode.window.showWarningMessage(
            'System Review là tính năng có rủi ro cao nhất. Bạn có chắc chắn muốn bật?',
            { modal: true },
            'Enable'
          );
          if (confirm !== 'Enable') return;
        }
        updateConfig((cfg) => {
          cfg.autoAccept.categories[categoryName].enabled = !cfg.autoAccept.categories[categoryName].enabled;
          return cfg;
        });
        refreshStatusBar();
      }
    },
    {
      label: '$(regex) Button Patterns',
      description: catConfig.buttons.join(', ') || '(Default buttons)',
      action: () => editPatternList(`autoAccept.categories.${categoryName}.buttons`, `${meta.label} Buttons`)
    },
    {
      label: '$(regex) Context Patterns',
      description: catConfig.context.join(', ') || '(Default context)',
      action: () => editPatternList(`autoAccept.categories.${categoryName}.context`, `${meta.label} Context`)
    }
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `${meta.label} Category Settings`
  });

  if (selected && typeof selected.action === 'function') {
    await selected.action();
    await openCategorySettings(categoryName);
  } else {
    await openAutoAcceptSettings();
  }
}

async function editStringList(path, label) {
  const config = readConfig();
  const parts = path.split('.');
  let current = config;
  for (const part of parts) current = current[part];

  const input = await vscode.window.showInputBox({
    prompt: `Enter items for ${label} (comma separated)`,
    value: current.join(', '),
    validateInput: (val) => {
      const list = val.split(',').map(s => s.trim()).filter(s => s);
      try {
        validateConfigField(path, list);
        return null;
      } catch (e) {
        return e.message;
      }
    }
  });

  if (input !== undefined) {
    const list = input.split(',').map(s => s.trim()).filter(s => s);
    updateConfig((cfg) => {
      let target = cfg;
      for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
      target[parts[parts.length - 1]] = list;
      return cfg;
    });
    refreshStatusBar();
    vscode.window.setStatusBarMessage(`${label} updated`, 3000);
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

async function showActivitySummary() {
  const summary = summarizeActivity(readActivityLog());
  
  const items = [
    {
      label: `$(zap) Total Clicks: ${summary.total}`,
      detail: `Retry: ${summary.retryClicks}, Accept: ${summary.acceptClicks}`,
      kind: vscode.QuickPickItemKind.Default,
      alwaysShow: true
    },
    {
      label: '--- By Category ---',
      kind: vscode.QuickPickItemKind.Separator
    }
  ];

  for (const [cat, count] of Object.entries(summary.byCategory)) {
    items.push({
      label: `${cat}`,
      description: `${count} clicks`,
      kind: vscode.QuickPickItemKind.Default
    });
  }

  items.push({
    label: '--- Top Skip Reasons ---',
    kind: vscode.QuickPickItemKind.Separator
  });

  const skipReasons = Object.entries(summary.skipReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (skipReasons.length === 0) {
    items.push({ label: 'No skip reasons recorded', kind: vscode.QuickPickItemKind.Default });
  } else {
    for (const [reason, count] of skipReasons) {
      items.push({
        label: reason,
        description: `${count} times`,
        kind: vscode.QuickPickItemKind.Default
      });
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Activity Summary Statistics'
  });

  if (selected) {
    await openControlCenter();
  }
}

async function showDiagnostics() {
  const diag = extensionState.diagnosticsService.getSystemDiagnostics();
  
  const items = [
    {
      label: `$(info) Daemon Status: ${diag.daemon.status.toUpperCase()}`,
      detail: `Running: ${diag.daemon.running}, Last Start: ${diag.daemon.lastStartTime ? new Date(diag.daemon.lastStartTime).toLocaleTimeString() : 'N/A'}`,
      alwaysShow: true
    },
    {
      label: `$(check-all) Config Health: ${diag.config.valid ? 'VALID' : 'HAS WARNINGS'}`,
      detail: diag.config.warnings.join(' | ') || 'No schema violations detected.',
      alwaysShow: true
    },
    {
      label: `$(debug) CDP State: ${diag.cdp.detected ? 'DETECTED' : 'NOT FOUND'}`,
      detail: diag.cdp.detected ? `Port: ${diag.cdp.port}` : 'No active Chrome Debugging Port found in process list.',
      alwaysShow: true
    },
    {
      label: `$(file) File Access: Activity Log is ${diag.files.activityLog.toUpperCase()}`,
      alwaysShow: true
    },
    {
      label: '--- Recent Logs (Tail) ---',
      kind: vscode.QuickPickItemKind.Separator
    }
  ];

  const logs = extensionState.diagnosticsService.getRecentLogs(10);
  const logLines = logs.split('\n').filter(l => l.trim());
  
  for (const line of logLines.reverse()) {
    items.push({
      label: line.substring(0, 100),
      detail: line.length > 100 ? line : undefined,
      kind: vscode.QuickPickItemKind.Default
    });
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'System Diagnostics & Health'
  });

  if (selected) {
    await openControlCenter();
  }
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
