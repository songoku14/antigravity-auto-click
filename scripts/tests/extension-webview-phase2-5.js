const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ActivityStore = require('../../src/core/activity-store');
const activityService = require('../../src/extension/activity-service');

const TEST_LOG_DIR = path.join(__dirname, '../../scratch/test-logs-2.5');
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'activity-log.json');

function cleanup() {
  if (fs.existsSync(TEST_LOG_FILE)) fs.unlinkSync(TEST_LOG_FILE);
  if (fs.existsSync(TEST_LOG_DIR)) fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
}

async function testPhase2_5() {
  console.log('--- Phase 2.5: Activity Store Enhancement — Button-level Tracking ---');
  cleanup();
  
  const store = new ActivityStore(TEST_LOG_DIR);

  // 1. Test update with button name for ACCEPT_CLICKED
  console.log('Testing ACCEPT_CLICKED with button name...');
  store.update('[STAT] ACCEPT_CLICKED:terminal button=Run');
  let data = store.load();
  assert.ok(data.accept.clickedByButton, 'clickedByButton should exist in accept');
  assert.strictEqual(data.accept.clickedByButton['Run'], 1, 'Run button should have 1 click');
  console.log('✅ ACCEPT_CLICKED button tracking passed');

  // 2. Test update with button name for RETRY_CLICKED
  console.log('Testing RETRY_CLICKED with button name...');
  store.update('[STAT] RETRY_CLICKED button=Retry');
  data = store.load();
  assert.ok(data.retry.clickedByButton, 'clickedByButton should exist in retry');
  assert.strictEqual(data.retry.clickedByButton['Retry'], 1, 'Retry button should have 1 click');
  console.log('✅ RETRY_CLICKED button tracking passed');

  // 3. Test summarizeActivity returns byButton
  console.log('Testing summarizeActivity return value...');
  // Need to mock activity-service path for this test
  const originalGetPath = activityService.readActivityLog;
  const summary = activityService.summarizeActivity(store.load());
  console.log('Summary:', JSON.stringify(summary, null, 2));
  assert.ok(summary.byButton, 'summary should contain byButton');
  assert.strictEqual(summary.byButton['Run'], 1);
  assert.strictEqual(summary.byButton['Retry'], 1);
  console.log('✅ summarizeActivity byButton check passed');

  // 4. Test resetActivity
  console.log('Testing resetActivity...');
  assert.ok(typeof activityService.resetActivity === 'function', 'resetActivity should exist');
  
  // To test resetActivity, we need to mock fs or path in activity-service
  // For now, let's just check if it's there and implement it to write the file
  activityService.resetActivity(TEST_LOG_FILE);
  const resetData = JSON.parse(fs.readFileSync(TEST_LOG_FILE, 'utf8'));
  assert.strictEqual(resetData.retry.clicked, 0);
  assert.deepStrictEqual(resetData.accept.clickedByButton, {});
  console.log('✅ resetActivity check passed');

  cleanup();
  console.log('\n✨ Phase 2.5 tests passed!');
}

testPhase2_5().catch(err => {
  console.error('\n❌ Phase 2.5 tests failed:');
  console.error(err);
  cleanup();
  process.exit(1);
});
