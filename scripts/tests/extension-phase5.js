/**
 * Test for Phase 5: Activity + Diagnostics logic
 */
const assert = require('assert');
const { summarizeActivity } = require('../../src/extension/activity-service');

function testSummarizeActivity() {
  console.log('Testing summarizeActivity...');
  
  const mockData = {
    retry: { clicked: 10 },
    accept: { 
      clicked: 5,
      clickedByCategory: {
        reviewchange: 3, // lowercase legacy or inconsistency
        terminal: 2
      }
    },
    skipReasons: {
      "test_reason": 1
    }
  };

  const summary = summarizeActivity(mockData);
  
  assert.strictEqual(summary.total, 15, 'Total clicks should be 15');
  assert.strictEqual(summary.retryClicks, 10, 'Retry clicks should be 10');
  assert.strictEqual(summary.acceptClicks, 5, 'Accept clicks should be 5');
  
  assert.strictEqual(summary.byCategory.reviewChange, 3, 'reviewchange should be normalized to reviewChange');
  assert.strictEqual(summary.byCategory.terminal, 2, 'terminal should be 2');
  
  console.log('✓ summarizeActivity tests passed');
}

async function testDiagnosticsService() {
  console.log('Testing diagnosticsService...');
  const { createDiagnosticsService } = require('../../src/extension/diagnostics-service');
  
  const mockDaemonService = {
    getState: () => ({ status: 'running', running: true, lastStartTime: 12345 })
  };
  
  // config-service is partially mocked by diagnostics-service.js requiring it
  // but we can at least check if it returns the expected structure
  const service = createDiagnosticsService(mockDaemonService);
  const diag = service.getSystemDiagnostics();
  
  assert.strictEqual(diag.daemon.status, 'running');
  assert.strictEqual(diag.daemon.running, true);
  assert.ok(diag.config.hasOwnProperty('valid'));
  assert.ok(diag.cdp.hasOwnProperty('detected'));
  
  console.log('✓ diagnosticsService tests passed');
}

async function runTests() {
  try {
    testSummarizeActivity();
    await testDiagnosticsService();
    console.log('\nAll Phase 5 logic tests passed!');
  } catch (error) {
    console.error('\nTest failed:', error.message);
    process.exit(1);
  }
}

runTests();
