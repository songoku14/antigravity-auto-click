#!/usr/bin/env node

const { getStoragePaths } = require('../../src/core/storage-paths');

const field = process.argv[2];
const paths = getStoragePaths();

if (!field || !Object.prototype.hasOwnProperty.call(paths, field)) {
  console.error(`Usage: node scripts/core/print-storage-path.js <${Object.keys(paths).join('|')}>`);
  process.exit(1);
}

process.stdout.write(paths[field]);
