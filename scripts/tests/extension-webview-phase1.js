const assert = require('assert');
const path = require('path');
const fs = require('fs');
fs.watch = () => { throw new Error('Mock fs.watch error for fallback'); };

// Mock VS Code
const vscodeMock = {
  EventEmitter: class {
    constructor() {
      this._listeners = [];
      this.event = (listener) => {
        this._listeners.push(listener);
        return { dispose: () => {} };
      };
    }
    fire(data) {
      for (const listener of this._listeners) {
        listener(data);
      }
    }
    dispose() {}
  },
  WebviewViewProvider: class {},
  window: {
    showInformationMessage: () => {},
    showErrorMessage: () => {}
  },
  workspace: {
    createFileSystemWatcher: () => ({
      onDidChange: () => {},
      onDidCreate: () => {},
      onDidDelete: () => {}
    })
  },
  Uri: {
    file: (p) => ({ fsPath: p, path: p, scheme: 'file' }),
    joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts), path: path.join(uri.path, ...parts), scheme: 'file' })
  },
  commands: {
    executeCommand: () => {}
  },
  ViewColumn: { Active: 1, Beside: 2 }
};

global.vscode = vscodeMock;
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path === 'vscode') return vscodeMock;
  return originalRequire.apply(this, arguments);
};

async function testPhase1() {
  console.log('--- Phase 1: Foundation — Webview Provider Setup ---');

  // 1. Check Constants
  console.log('Testing constants...');
  const constants = require('../../src/extension/constants');
  assert.ok(constants.VIEW_ID, 'VIEW_ID should be defined');
  assert.strictEqual(constants.VIEW_ID, 'antigravity-auto-click.controlCenter');
  assert.ok(constants.MESSAGE_TYPES, 'MESSAGE_TYPES should be defined');
  assert.ok(constants.MESSAGE_TYPES.UPDATE_STATE, 'UPDATE_STATE message type should be defined');
  console.log('✅ Constants check passed');

  // 2. Check Provider Class
  console.log('Testing ControlCenterViewProvider class...');
  const { ControlCenterViewProvider } = require('../../src/extension/webview-provider');
  assert.ok(ControlCenterViewProvider, 'ControlCenterViewProvider should be exported');
  
  const mockConfigService = {
    getConfig: () => ({ autoRetry: { enabled: true } })
  };
  const mockDaemonService = {
    getState: () => ({ running: true })
  };
  const mockActivityService = {
    summarizeActivity: () => ({ total: 0 })
  };

  const provider = new ControlCenterViewProvider(
    vscodeMock.Uri.file(path.join(__dirname, '../../')),
    mockConfigService,
    mockDaemonService,
    mockActivityService
  );

  assert.ok(typeof provider.show === 'function', 'show method should exist');
  console.log('✅ Provider class check passed');

  // 3. Check HTML content and _updateWebview
  console.log('Testing HTML output and _updateWebview...');
  let lastMessage = null;
  const mockPanel = {
    webview: {
      options: {},
      html: '',
      onDidReceiveMessage: () => {},
      postMessage: (msg) => { lastMessage = msg; },
      asWebviewUri: (uri) => uri
    },
    reveal: () => {},
    onDidChangeViewState: () => ({ dispose: () => {} }),
    onDidDispose: () => ({ dispose: () => {} })
  };

  vscodeMock.window.createWebviewPanel = () => mockPanel;

  // Initialize the provider with a mock view
  provider.resolveWebviewView(mockPanel, {}, {});
  
  assert.ok(mockPanel.webview.html.toLowerCase().includes('content-security-policy'), 'HTML should contain CSP meta tag');
  assert.ok(mockPanel.webview.html.includes('nonce-'), 'HTML should contain nonce');

  // Trigger update
  provider._updateWebview();
  assert.ok(lastMessage, 'postMessage should have been called');
  assert.strictEqual(lastMessage.type, constants.MESSAGE_TYPES.UPDATE_STATE, 'Message type should be UPDATE_STATE');
  console.log('✅ HTML and state update check passed');

  console.log('\n✨ Phase 1 tests passed!');
}

testPhase1().catch(err => {
  console.error('\n❌ Phase 1 tests failed:');
  console.error(err);
  process.exit(1);
});
