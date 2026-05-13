const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const ActivityStore = require('../../src/core/activity-store');

function makeTempStore() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-activity-store-'));
  const logsDir = path.join(tempRoot, 'logs');
  return {
    tempRoot,
    logsDir,
    store: new ActivityStore(logsDir)
  };
}

function cleanupTempStore(tempRoot) {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function testAcceptCategoryTracksActualClicks() {
  const ctx = makeTempStore();
  try {
    ctx.store.update('[AutoRetry] [STAT] ACCEPT_DETECTED:terminal');
    ctx.store.update('[AutoRetry] [STAT] ACCEPT_CLICKED:terminal');
    const activity = ctx.store.load();

    assert.strictEqual(activity.accept.detected, 1);
    assert.strictEqual(activity.accept.clicked, 1);
    assert.deepStrictEqual(activity.accept.detectedByCategory, { terminal: 1 });
    assert.deepStrictEqual(activity.accept.clickedByCategory, { terminal: 1 });
  } finally {
    cleanupTempStore(ctx.tempRoot);
  }
}

function testBlockedDoesNotDoubleCountSkip() {
  const ctx = makeTempStore();
  try {
    ctx.store.update('[AutoRetry] [STAT] ACCEPT_DETECTED:review');
    ctx.store.update('[AutoRetry] [STAT] ACCEPT_SKIPPED: blacklist');
    ctx.store.update('[AutoRetry] [STAT] ACCEPT_BLOCKED:review');
    const activity = ctx.store.load();

    assert.strictEqual(activity.accept.candidates, 2);
    assert.strictEqual(activity.accept.detected, 1);
    assert.strictEqual(activity.accept.skipped, 1);
    assert.strictEqual(activity.accept.blocked, 1);
    assert.strictEqual(activity.skipReasons['accept:blacklist'], 1);
    assert.strictEqual(activity.skipReasons['accept:blocked'], undefined);
  } finally {
    cleanupTempStore(ctx.tempRoot);
  }
}

function testInvalidCategoryNoiseIsIgnored() {
  const ctx = makeTempStore();
  try {
    ctx.store.update('[AutoRetry] [STAT] ACCEPT_CLICKED:⚡');
    ctx.store.update('[AutoRetry] [STAT] ACCEPT_DETECTED:\'');
    const activity = ctx.store.load();

    assert.strictEqual(activity.accept.clicked, 1);
    assert.strictEqual(activity.accept.detected, 1);
    assert.deepStrictEqual(activity.accept.clickedByCategory, {});
    assert.deepStrictEqual(activity.accept.detectedByCategory, {});
  } finally {
    cleanupTempStore(ctx.tempRoot);
  }
}

function main() {
  testAcceptCategoryTracksActualClicks();
  testBlockedDoesNotDoubleCountSkip();
  testInvalidCategoryNoiseIsIgnored();
  console.log('activity-store tests passed');
}

main();
