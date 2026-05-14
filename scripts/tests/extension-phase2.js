const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

// Mocking some paths for the services to work during tests
const activityService = require('../../src/extension/activity-service');
const statusService = require('../../src/extension/status-service');
const configService = require('../../src/extension/config-service');

function testActivitySummarization() {
  console.log('Testing activity-service summarization...');
  
  // Case 1: Empty data
  const summary1 = activityService.summarizeActivity(null);
  assert.strictEqual(summary1.total, 0);
  assert.strictEqual(summary1.retryClicks, 0);
  assert.strictEqual(summary1.acceptClicks, 0);

  // Case 2: Valid data object (matching ActivityStore format)
  const mockData = {
    retry: { clicked: 5 },
    accept: { 
      clicked: 10, 
      clickedByCategory: { terminal: 7, reviewChange: 3 } 
    },
    skipReasons: { 'accept:blacklist': 2 }
  };
  const summary2 = activityService.summarizeActivity(mockData);
  assert.strictEqual(summary2.total, 15);
  assert.strictEqual(summary2.retryClicks, 5);
  assert.strictEqual(summary2.acceptClicks, 10);
  assert.strictEqual(summary2.byCategory.terminal, 7);
  assert.strictEqual(summary2.skipReasons['accept:blacklist'], 2);

  console.log('✅ activity-service tests passed');
}

function testStatusBarStateBuilding() {
  console.log('Testing status-service building...');

  const mockConfig = {
    autoRetry: { enabled: true },
    autoAccept: { 
      enabled: true,
      categories: {
        terminal: { enabled: true },
        reviewChange: { enabled: false },
        systemReview: { enabled: true }
      }
    }
  };

  const mockDaemonState = { running: true };
  const mockActivitySummary = { total: 10, retryClicks: 4, acceptClicks: 6 };

  // Case 1: Running with some features
  const state1 = statusService.buildStatusBarState({
    config: mockConfig,
    daemonState: mockDaemonState,
    activitySummary: mockActivitySummary
  });

  // Badge should be R / A:t,s
  assert.ok(state1.text.includes('R / A:t,s'));
  assert.ok(state1.tooltip.includes('RUNNING'));
  assert.ok(state1.tooltip.includes('4 retries, 6 accepts'));

  // Case 2: Stopped
  const state2 = statusService.buildStatusBarState({
    config: mockConfig,
    daemonState: { running: false },
    activitySummary: mockActivitySummary
  });
  assert.ok(state2.text.includes('AG Auto'));
  assert.ok(!state2.text.includes('R / A:t,s')); // Should not show summary when stopped
  assert.ok(state2.tooltip.includes('STOPPED'));

  // Case 3: All OFF
  const state3 = statusService.buildStatusBarState({
    config: { autoRetry: { enabled: false }, autoAccept: { enabled: false } },
    daemonState: { running: true },
    activitySummary: null
  });
  assert.ok(state3.text.includes('OFF'));

  console.log('✅ status-service tests passed');
}

function testConfigMigrationWarnings() {
  console.log('Testing config-service migration warnings...');

  // getContractSummary returns an array of field definitions
  const summary = configService.getContractSummary();
  const paths = summary.map(s => s.path);
  
  assert.ok(paths.includes('autoRetry.enabled'));
  assert.ok(paths.includes('autoAccept.enabled'));
  // Check per-category fields
  assert.ok(paths.includes('autoAccept.categories.terminal.enabled'));
  assert.ok(paths.includes('autoAccept.categories.reviewChange.enabled'));
  assert.ok(paths.includes('autoAccept.categories.systemReview.enabled'));
  
  console.log('✅ config-service contract check passed');
}

function main() {
  try {
    testActivitySummarization();
    testStatusBarStateBuilding();
    testConfigMigrationWarnings();
    console.log('\n✨ All Phase 2 Auto Tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
