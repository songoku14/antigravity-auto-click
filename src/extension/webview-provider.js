const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { MESSAGE_TYPES } = require('./constants');

class ControlCenterViewProvider {
  constructor(extensionUri, configService, daemonService, activityService, syncDaemonWithConfig) {
    this._extensionUri = extensionUri;
    this._configService = configService;
    this._daemonService = daemonService;
    this._activityService = activityService;
    this._syncDaemonWithConfig = syncDaemonWithConfig;
    this._view = undefined;

    this._setupFileWatchers();
  }

  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'src', 'extension', 'media')
      ]
    };

    // Only set HTML if it's empty to avoid unnecessary reloads
    if (!webviewView.webview.html) {
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    webviewView.webview.onDidReceiveMessage(async data => {
      switch (data.type) {
        case MESSAGE_TYPES.TOGGLE_FEATURE:
          await this._handleToggleFeature(data.feature, data.value);
          break;
        case MESSAGE_TYPES.UPDATE_BLACKLIST:
          await this._handleUpdateBlacklist(data.value);
          break;
        case MESSAGE_TYPES.RESET_STATS:
          await this._handleResetStats();
          break;
        case MESSAGE_TYPES.OPEN_CONFIG:
          vscode.commands.executeCommand('antigravity-auto-click.openConfig');
          break;
        case 'READY': // New message type for instant update
          this._updateWebview();
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this._view = undefined;
    });

    // Send initial update as soon as possible
    this._updateWebview();
  }

  show() {
    // Focus the view in the sidebar
    if (this._view) {
      this._view.show(true);
    } else {
      // Use the standard view focus command
      vscode.commands.executeCommand('antigravity-auto-click.controlCenter.focus');
    }
  }

  _updateWebview(forceRefresh = false) {
    if (!this._view) return;

    const config = this._configService.getConfig();
    const daemonState = this._daemonService.getState();
    const activitySummary = this._activityService.summarizeActivity(forceRefresh);

    this._view.webview.postMessage({
      type: MESSAGE_TYPES.UPDATE_STATE,
      state: {
        config,
        daemonState,
        activitySummary
      }
    });
  }

  async _handleToggleFeature(featurePath, value) {
    // Safety gate for systemReview
    if (featurePath === 'autoAccept.categories.systemReview.enabled' && value === true) {
      const confirm = await vscode.window.showWarningMessage(
        'System Review là tính năng có rủi ro cao nhất. Bạn có chắc chắn muốn bật?',
        { modal: true },
        'Enable'
      );
      if (confirm !== 'Enable') {
        this._updateWebview(); // Revert UI state
        return;
      }
    }

    this._configService.updateConfig(cfg => {
      const keys = featurePath.split('.');
      let target = cfg;
      for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = value;

      // Sync master switch with categories
      if (featurePath.startsWith('autoAccept.categories.')) {
        if (value === true) {
          cfg.autoAccept.enabled = true;
        } else {
          // If all categories are OFF, turn OFF master
          const categories = cfg.autoAccept.categories || {};
          const anyEnabled = Object.values(categories).some(cat => cat && cat.enabled);
          if (!anyEnabled) {
            cfg.autoAccept.enabled = false;
          }
        }
      }

      return cfg;
    });

    if (this._syncDaemonWithConfig) {
      await this._syncDaemonWithConfig();
    }
    
    this._updateWebview();
  }

  async _handleUpdateBlacklist(textValue) {
    const list = textValue
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    this._configService.updateConfig(cfg => {
      cfg.autoAccept.blacklist = list;
      return cfg;
    });

    if (this._syncDaemonWithConfig) {
      await this._syncDaemonWithConfig();
    }
    
    this._updateWebview();
  }

  async _handleResetStats() {
    this._activityService.resetActivity();
    this._updateWebview(true); // Force refresh after reset
  }

  _setupFileWatchers() {
    const configPath = typeof this._configService.getConfigPath === 'function'
      ? this._configService.getConfigPath()
      : 'config.json';
    const activityLogPath = typeof this._configService.getActivityLogPath === 'function'
      ? this._configService.getActivityLogPath()
      : 'activity-log.json';

    const configWatcher = createExactFileWatcher(configPath);
    configWatcher.onDidChange(() => this._updateWebview());
    configWatcher.onDidCreate(() => this._updateWebview());
    configWatcher.onDidDelete(() => this._updateWebview());

    const activityWatcher = createExactFileWatcher(activityLogPath);
    activityWatcher.onDidChange(() => this._updateWebview(true));
    activityWatcher.onDidCreate(() => this._updateWebview(true));
    activityWatcher.onDidDelete(() => this._updateWebview(true));
  }

  _getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'extension', 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'extension', 'media', 'main.css'));

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Control Center</title>
</head>
<body>
    <div class="container">
        <!-- PAGE: MAIN -->
        <div id="page-main" class="page">
            <div class="header">
                <div class="title">⚡ Auto Click</div>
                <div class="status-badge">
                    <div id="status-dot" class="status-dot"></div>
                    <span id="status-text">Đang tải...</span>
                </div>
            </div>

            <div class="feature-section">
                <div class="feature-grid">
                    <!-- Auto Retry -->
                    <div class="feature-card">
                        <div class="feature-row main-row">
                            <div class="feature-info">
                                <span class="feature-label">🔄 Auto Retry</span>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="toggle-retry" data-feature="autoRetry.enabled">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>

                    <!-- Auto Accept -->
                    <div class="feature-card">
                        <div class="feature-row main-row">
                            <div class="feature-info">
                                <span class="feature-label">✅ Auto Accept</span>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="toggle-accept" data-feature="autoAccept.enabled">
                                <span class="slider"></span>
                            </label>
                        </div>
                        
                        <div id="categories-container" class="categories-container">
                            <div class="category-row">
                                <div class="category-info">
                                    <div class="category-header">
                                        <span class="category-label">💻 Terminal</span>
                                        <div id="buttons-terminal" class="category-buttons"></div>
                                    </div>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="toggle-terminal" data-feature="autoAccept.categories.terminal.enabled">
                                    <span class="slider"></span>
                                </label>
                            </div>

                            <div class="category-row">
                                <div class="category-info">
                                    <div class="category-header">
                                        <span class="category-label">📝 Review Change</span>
                                        <div id="buttons-reviewChange" class="category-buttons"></div>
                                    </div>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="toggle-review" data-feature="autoAccept.categories.reviewChange.enabled">
                                    <span class="slider"></span>
                                </label>
                            </div>

                            <div class="category-row">
                                <div class="category-info">
                                    <div class="category-header">
                                        <span class="category-label">🔒 System Review</span>
                                        <div id="buttons-systemReview" class="category-buttons"></div>
                                    </div>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="toggle-system" data-feature="autoAccept.categories.systemReview.enabled">
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="feature-section compact">
                <div class="section-title">Blacklist</div>
                <div class="blacklist-container">
                    <div id="blacklist-tags" class="blacklist-tags"></div>
                    <div class="blacklist-add-row">
                        <input type="text" id="blacklist-add-input" class="blacklist-input" placeholder="Thêm lệnh...">
                        <button id="btn-add-blacklist" class="add-btn">+</button>
                    </div>
                </div>
            </div>

            <div id="notification-toast" class="notification-toast hidden"></div>

            <div class="stats-section">
                <div class="stats-header">
                    <div class="stats-total-container">
                        <span class="stats-label">⚡ Total Actions</span>
                        <div id="stat-total-actions" class="stats-value big glow">0</div>
                    </div>
                </div>
                <div class="stats-grid">
                    <div class="stats-card">
                        <div class="card-title">🔄 Auto Retry</div>
                        <div id="stat-retry-total" class="stats-value">0</div>
                        <div class="card-subtitle">retried</div>
                    </div>
                    <div class="stats-card">
                        <div class="card-title">✅ Auto Accept</div>
                        <div id="stat-accept-total" class="stats-value">0</div>
                        <div class="card-subtitle">accepted</div>
                        
                        <div class="progress-breakdown">
                            <div class="progress-item">
                                <div class="progress-info">
                                    <span>Terminal</span>
                                    <span id="stat-accept-t" class="p-val">0</span>
                                </div>
                                <div class="progress-bar-bg">
                                    <div id="bar-terminal" class="progress-bar-fill term" style="width: 0%"></div>
                                </div>
                            </div>
                            <div class="progress-item">
                                <div class="progress-info">
                                    <span>Review</span>
                                    <span id="stat-accept-r" class="p-val">0</span>
                                </div>
                                <div class="progress-bar-bg">
                                    <div id="bar-review" class="progress-bar-fill rev" style="width: 0%"></div>
                                </div>
                            </div>
                            <div class="progress-item">
                                <div class="progress-info">
                                    <span>System</span>
                                    <span id="stat-accept-s" class="p-val">0</span>
                                </div>
                                <div class="progress-bar-bg">
                                    <div id="bar-system" class="progress-bar-fill sys" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="footer">
                <button id="btn-open-config" class="link-btn">⚙️ Config</button>
                <button id="btn-reset-stats" class="link-btn danger">🔄 Reset Stats</button>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createExactFileWatcher(filePath) {
  if (vscode.RelativePattern && path.isAbsolute(filePath)) {
    return vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath))
    );
  }
  return vscode.workspace.createFileSystemWatcher(filePath);
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

module.exports = {
  ControlCenterViewProvider
};
