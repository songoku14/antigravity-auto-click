const { spawnSync } = require('child_process');
const path = require('path');

const phaseTests = [
  'extension-phase2.js',
  'extension-phase3.js',
  'extension-phase4.js',
  'extension-phase5.js',
  'extension-phase6.js',
  'extension-phase7.js'
];

let failed = false;

for (const file of phaseTests) {
  console.log(`\n=== Running ${file} ===`);
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    failed = true;
    console.error(`\n${file} failed with exit code ${result.status}.`);
    break;
  }
}

if (failed) {
  process.exit(1);
}

console.log('\nAll extension phase tests passed.');
