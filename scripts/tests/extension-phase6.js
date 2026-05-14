const assert = require('assert');
const { createDaemonService } = require('../../src/extension/daemon-service');

async function testStateTransitions() {
  console.log('Testing Phase 6 state transitions...');
  const outputChannel = { appendLine: () => {}, append: () => {} };
  const daemon = createDaemonService(outputChannel);

  // Initial state
  assert.strictEqual(daemon.getState().status, 'stopped');
  assert.strictEqual(daemon.getState().running, false);

  // Start
  console.log('  - Testing start...');
  const startResult = daemon.start();
  // Since spawn is async, status might be 'starting' or 'running' depending on implementation
  // But for this test, we want to see it NOT stopped
  assert.notStrictEqual(daemon.getState().status, 'stopped');
  
  // Wait a bit for process to actually start or mock it
  // In real life we'd wait, here we just check if it's not stopped
  
  // Stop
  console.log('  - Testing stop...');
  await daemon.stop();
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(daemon.getState().status, 'stopped');
  assert.strictEqual(daemon.getState().running, false);

  console.log('✅ State transitions tests passed');
}

async function testDoubleStart() {
  console.log('Testing prevention of double start...');
  const outputChannel = { appendLine: () => {}, append: () => {} };
  const daemon = createDaemonService(outputChannel);

  daemon.start();
  const state1 = daemon.getState();
  
  daemon.start();
  const state2 = daemon.getState();
  
  // Should return the same state or at least not spawn a new one
  assert.strictEqual(state1.status, state2.status);
  
  await daemon.stop();
  console.log('✅ Double start prevention tests passed');
}

async function main() {
  try {
    await testStateTransitions();
    await testDoubleStart();
    console.log('\n✨ All Phase 6 Auto Tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    throw error;
  }
}

main();
