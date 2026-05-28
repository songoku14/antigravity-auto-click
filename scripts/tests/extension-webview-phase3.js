const assert = require('assert');
const path = require('path');
const fs = require('fs');
fs.watch = () => { throw new Error('Mock fs.watch error for fallback'); };

// Mock VS Code
let lastWarningMessage = null;
let warningCallback = null;
let watcherCallback = null;

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
    showErrorMessage: () => {},
    showWarningMessage: (msg, ...args) => {
      lastWarningMessage = msg;
      // Extract items (skip options if present)
      const items = typeof args[0] === 'object' && args[0].modal !== undefined ? args.slice(1) : args;
      if (warningCallback) return warningCallback(msg, items);
      return Promise.resolve(items[0]);
    }
  },
  workspace: {
    createFileSystemWatcher: (pattern) => ({
      onDidChange: (cb) => { watcherCallback = cb; },
      onDidCreate: () => {},
      onDidDelete: () => {}
    })
  },
  Uri: {
    file: (p) => ({ fsPath: p, path: p, scheme: 'file' }),
    joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts), path: path.join(uri.path, ...parts), scheme: 'file' })
  },
  commands: {
    executeCommand: (cmd) => { lastCommand = cmd; }
  },
  ViewColumn: { Active: 1, Beside: 2 }
};

let lastCommand = null;

global.vscode = vscodeMock;
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path === 'vscode') return vscodeMock;
  return originalRequire.apply(this, arguments);
};

const { MESSAGE_TYPES } = require('../../src/extension/constants');

async function testPhase3() {
  console.log('--- Phase 3: Message Passing & State Sync ---');

  const { ControlCenterViewProvider } = require('../../src/extension/webview-provider');
  
  let config = {
    autoRetry: { enabled: false },
    autoAccept: { enabled: false, categories: { terminal: { enabled: false }, systemReview: { enabled: false } }, blacklist: [] }
  };
  
  const mockConfigService = {
    getConfig: () => config,
    updateConfig: (mutator) => {
      config = mutator(config);
    }
  };
  
  let syncDaemonCalled = false;
  const mockDaemonService = {
    getState: () => ({ running: true }),
    syncDaemonWithConfig: async () => { syncDaemonCalled = true; }
  };
  
  let resetStatsCalled = false;
  const mockActivityService = {
    summarizeActivity: () => ({ total: 0 }),
    resetActivity: () => { resetStatsCalled = true; }
  };

  const provider = new ControlCenterViewProvider(
    vscodeMock.Uri.file(path.join(__dirname, '../../')),
    mockConfigService,
    mockDaemonService,
    mockActivityService,
    async () => { syncDaemonCalled = true; }
  );

  let messageHandler = null;
  let lastPostedMessage = null;
  const mockPanel = {
    webview: {
      options: {},
      html: '',
      onDidReceiveMessage: (cb) => { messageHandler = cb; },
      postMessage: (msg) => { lastPostedMessage = msg; },
      asWebviewUri: (uri) => uri
    },
    reveal: () => {},
    show: () => {},
    onDidChangeViewState: () => ({ dispose: () => {} }),
    onDidDispose: () => ({ dispose: () => {} })
  };

  vscodeMock.window.createWebviewPanel = () => mockPanel;

  provider.resolveWebviewView(mockPanel, {}, {});
  provider.show();

  // 1. Test TOGGLE_FEATURE (autoRetry.enabled)
  console.log('Testing TOGGLE_FEATURE (autoRetry.enabled)...');
  await messageHandler({ type: MESSAGE_TYPES.TOGGLE_FEATURE, feature: 'autoRetry.enabled', value: true });
  assert.strictEqual(config.autoRetry.enabled, true, 'autoRetry.enabled should be true');
  assert.ok(syncDaemonCalled, 'syncDaemonWithConfig should have been called');
  console.log('✅ TOGGLE_FEATURE (autoRetry.enabled) passed');

  // 2. Test TOGGLE_FEATURE (nested: autoAccept.categories.terminal.enabled)
  console.log('Testing TOGGLE_FEATURE (nested field)...');
  await messageHandler({ type: MESSAGE_TYPES.TOGGLE_FEATURE, feature: 'autoAccept.categories.terminal.enabled', value: true });
  assert.strictEqual(config.autoAccept.categories.terminal.enabled, true, 'terminal enabled should be true');
  console.log('✅ TOGGLE_FEATURE (nested) passed');

  // 3. Test UPDATE_BLACKLIST
  console.log('Testing UPDATE_BLACKLIST...');
  await messageHandler({ type: MESSAGE_TYPES.UPDATE_BLACKLIST, value: 'rm, sudo, force' });
  assert.deepStrictEqual(config.autoAccept.blacklist, ['rm', 'sudo', 'force'], 'Blacklist should be correctly updated');
  
  await messageHandler({ type: MESSAGE_TYPES.UPDATE_BLACKLIST, value: 'rm, , sudo, ' });
  assert.deepStrictEqual(config.autoAccept.blacklist, ['rm', 'sudo'], 'Blacklist should filter empty items');
  console.log('✅ UPDATE_BLACKLIST passed');

  // 4. Test Safety Gate (systemReview)
  console.log('Testing Safety Gate (systemReview)...');
  lastWarningMessage = null;
  // Case: User cancels
  warningCallback = (msg, items) => Promise.resolve(undefined);
  await messageHandler({ type: MESSAGE_TYPES.TOGGLE_FEATURE, feature: 'autoAccept.categories.systemReview.enabled', value: true });
  assert.ok(lastWarningMessage.includes('System Review'), 'Should show warning for System Review');
  assert.strictEqual(config.autoAccept.categories.systemReview.enabled, false, 'Should NOT enable if cancelled');
  
  // Case: User confirms
  warningCallback = (msg, items) => Promise.resolve(items[0]);
  await messageHandler({ type: MESSAGE_TYPES.TOGGLE_FEATURE, feature: 'autoAccept.categories.systemReview.enabled', value: true });
  assert.strictEqual(config.autoAccept.categories.systemReview.enabled, true, 'Should enable if confirmed');
  console.log('✅ Safety Gate passed');

  // 5. Test RESET_STATS
  console.log('Testing RESET_STATS...');
  await messageHandler({ type: MESSAGE_TYPES.RESET_STATS });
  assert.ok(resetStatsCalled, 'resetActivity should have been called');
  console.log('✅ RESET_STATS passed');

  // 6. Test OPEN_CONFIG
  console.log('Testing OPEN_CONFIG...');
  lastCommand = null;
  await messageHandler({ type: MESSAGE_TYPES.OPEN_CONFIG });
  assert.strictEqual(lastCommand, 'antigravity-auto-click.openConfig', 'Should execute openConfig command');
  console.log('✅ OPEN_CONFIG passed');

  // 7. Test File Watcher
  console.log('Testing File Watcher...');
  assert.ok(watcherCallback, 'Watcher callback should be registered');
  lastPostedMessage = null;
  watcherCallback(vscodeMock.Uri.file('config.json'));
  assert.ok(lastPostedMessage, 'postMessage should be called on file change');
  assert.strictEqual(lastPostedMessage.type, MESSAGE_TYPES.UPDATE_STATE, 'Should post UPDATE_STATE');
  console.log('✅ File Watcher passed');

  console.log('\n✨ Phase 3 tests passed!');
}

testPhase3().catch(err => {
  console.error('\n❌ Phase 3 tests failed:');
  console.error(err);
  process.exit(1);
});
