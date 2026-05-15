const { spawnSync } = require('child_process');
const path = require('path');

const webviewPhaseTests = [
  'extension-webview-phase1.js',
  'extension-webview-phase2.js',
  'extension-webview-phase2-5.js',
  'extension-webview-phase3.js',
  'extension-webview-phase4.js'
];

let failed = false;

console.log('=== Running Webview Control Center Test Suite ===');

for (const file of webviewPhaseTests) {
  console.log(`\n> Running ${file}...`);
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    failed = true;
    console.error(`\n❌ ${file} failed with exit code ${result.status}.`);
    break;
  }
}

if (failed) {
  console.error('\n❌ Test suite failed.');
  process.exit(1);
}

console.log('\n✨ All Webview Control Center phase tests passed!');
