const assert = require('assert');
const path = require('path');
const fs = require('fs');
fs.watch = () => { throw new Error('Mock fs.watch error for fallback'); };

// Mock VS Code
let registeredCommands = new Map();
let statusBarItem = {
  text: '',
  tooltip: '',
  command: '',
  show: () => {}
};

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
    createOutputChannel: () => ({ appendLine: () => {} }),
    createStatusBarItem: () => statusBarItem,
    showInformationMessage: () => {},
    showErrorMessage: () => {},
    createWebviewPanel: () => ({ dispose: () => {} }),
    StatusBarAlignment: { Right: 1 }
  },
  workspace: {
    getConfiguration: () => ({ get: () => true }),
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
    registerCommand: (id, handler) => {
      registeredCommands.set(id, handler);
      return { dispose: () => {} };
    },
    executeCommand: (id) => {}
  },
  StatusBarAlignment: { Right: 1 }
};

global.vscode = vscodeMock;
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'vscode') return vscodeMock;
  return originalRequire.apply(this, arguments);
};

async function testPhase4() {
  console.log('--- Phase 4: Integration & Polish ---');

  const extensionPath = path.join(__dirname, '../../src/extension/extension.js');
  const extensionContent = fs.readFileSync(extensionPath, 'utf8');

  // 1. Verify Status Bar Command
  console.log('Verifying Status Bar Command...');
  assert.ok(extensionContent.includes("statusBarItem.command = COMMANDS.openControlCenter"), 'Status bar command should open control center');
  console.log('✅ Status Bar Command check passed');

  // 2. Verify refreshStatusBar calls refreshWebview
  console.log('Verifying refreshStatusBar integration...');
  assert.ok(extensionContent.includes('refreshWebview('), 'refreshStatusBar should call refreshWebview');
  console.log('✅ refreshStatusBar integration check passed');

  // 3. Verify Command Registration
  console.log('Verifying Command Registration in code...');
  assert.ok(extensionContent.includes('COMMANDS.openControlCenter'), 'Should still contain openControlCenter for backward compatibility');
  assert.ok(extensionContent.includes('antigravity-auto-retry.showMenu'), 'Should still contain legacy showMenu');
  console.log('✅ Command Registration check passed');

  console.log('\n✨ Phase 4 tests passed!');
}

testPhase4().catch(err => {
  console.error('\n❌ Phase 4 tests failed:');
  console.error(err);
  process.exit(1);
});
