#!/usr/bin/env node
/**
 * Backward-compatible wrapper.
 *
 * Old entry point for Auto-Accept category statistics. The consolidated
 * activity report now lives in `list-activity-stats.js`.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, 'list-activity-stats.js');
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
