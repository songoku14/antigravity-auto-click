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

async function testPhase2() {
  console.log('--- Phase 2: UI Template — HTML/CSS/JS ---');

  const { ControlCenterViewProvider } = require('../../src/extension/webview-provider');
  const provider = new ControlCenterViewProvider(
    vscodeMock.Uri.file(path.join(__dirname, '../../')),
    { getConfig: () => ({}) },
    { getState: () => ({}) },
    { summarizeActivity: () => ({}) }
  );

  const mockPanel = {
    webview: {
      options: {},
      html: '',
      onDidReceiveMessage: () => {},
      postMessage: () => {},
      asWebviewUri: (uri) => uri
    },
    reveal: () => {},
    onDidChangeViewState: () => ({ dispose: () => {} }),
    onDidDispose: () => ({ dispose: () => {} })
  };

  vscodeMock.window.createWebviewPanel = () => mockPanel;

  // Initialize the provider with a mock view
  provider.resolveWebviewView(mockPanel, {}, {});
  const html = mockPanel.webview.html;

  // 1. HTML structure
  console.log('Testing HTML structure...');
  assert.ok(html.includes('page-main'), 'HTML should contain page-main');
  
  // page-main elements
  assert.ok(html.includes('autoRetry.enabled'), 'Should contain autoRetry toggle');
  assert.ok(html.includes('autoAccept.enabled'), 'Should contain autoAccept toggle');
  assert.ok(html.includes('terminal'), 'Should contain terminal toggle');
  assert.ok(html.includes('reviewChange'), 'Should contain reviewChange toggle');
  assert.ok(html.includes('systemReview'), 'Should contain systemReview toggle');
  assert.ok(html.includes('blacklist'), 'Should contain blacklist input');
  assert.ok(html.includes('status'), 'Should contain status indicator');
  
  // page-stats elements
  assert.ok(html.includes('stats-grid') || html.includes('stats-card'), 'Should contain stats grid or card');
  assert.ok(html.includes('badge') || html.includes('stats-value'), 'Should contain status badge or stats value');
  assert.ok(html.includes('btn-reset-stats'), 'Should contain Reset button');

  // Exclusion
  assert.ok(!html.includes('performClick'), 'Should NOT contain performClick toggle');
  console.log('✅ HTML structure check passed');

  // 2. CSS and JS files
  console.log('Testing CSS and JS files...');
  const mediaDir = path.join(__dirname, '../../src/extension/media');
  const cssPath = path.join(mediaDir, 'main.css');
  const jsPath = path.join(mediaDir, 'main.js');

  assert.ok(fs.existsSync(cssPath), 'main.css should exist');
  assert.ok(fs.statSync(cssPath).size > 0, 'main.css should not be empty');
  
  assert.ok(fs.existsSync(jsPath), 'main.js should exist');
  assert.ok(fs.statSync(jsPath).size > 0, 'main.js should not be empty');
  console.log('✅ CSS and JS files check passed');

  console.log('\n✨ Phase 2 tests passed!');
}

testPhase2().catch(err => {
  console.error('\n❌ Phase 2 tests failed:');
  console.error(err);
  process.exit(1);
});
