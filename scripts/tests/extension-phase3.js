const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TEST_STORAGE_DIR = path.join(__dirname, '../../scratch/test-storage-phase3');
process.env.ANTIGRAVITY_AUTO_CLICK_HOME = TEST_STORAGE_DIR;

if (fs.existsSync(TEST_STORAGE_DIR)) {
  fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
}

const configService = require('../../src/extension/config-service');
const { DEFAULT_CONFIG } = require('../../src/core/config-schema');

function testValidation() {
  console.log('Testing config validation logic...');

  // 1. Test Number Validation
  // Expected: throw or return error for negative/invalid numbers
  console.log('  - Testing numbers...');
  try {
    configService.validateConfigField('autoRetry.timing.pollInterval', -100);
    assert.fail('Should have thrown for negative pollInterval');
  } catch (e) {
    assert.ok(e.message.includes('positive number'));
  }

  try {
    configService.validateConfigField('autoRetry.timing.pollInterval', 50);
    assert.fail('Should have thrown for pollInterval < 100');
  } catch (e) {
    assert.ok(e.message.includes('at least 100'));
  }

  // 2. Test Pattern List Validation
  console.log('  - Testing pattern lists...');
  try {
    configService.validateConfigField('autoRetry.errorPatterns', ['[invalid(']);
    assert.fail('Should have thrown for invalid regex');
  } catch (e) {
    assert.ok(e.message.includes('Invalid regular expression'));
  }

  // 3. Test Valid Inputs
  configService.validateConfigField('autoRetry.timing.pollInterval', 500);
  configService.validateConfigField('autoRetry.errorPatterns', ['retry', 'reload']);

  console.log('✅ Validation tests passed (if logic was implemented)');
}

function testResetBlock() {
  console.log('Testing resetConfigBlock...');
  
  // Modify config
  configService.updateConfig((config) => {
    config.autoRetry.enabled = false;
    config.autoRetry.timing.pollInterval = 9999;
    return config;
  });

  // Reset block
  configService.resetConfigBlock('autoRetry');
  
  const config = configService.readConfig();
  assert.strictEqual(config.autoRetry.enabled, DEFAULT_CONFIG.autoRetry.enabled);
  assert.strictEqual(config.autoRetry.timing.pollInterval, DEFAULT_CONFIG.autoRetry.timing.pollInterval);

  console.log('✅ resetConfigBlock tests passed');
}

function main() {
  try {
    // Note: These will fail until validateConfigField and resetConfigBlock are implemented
    testValidation();
    testResetBlock();
    console.log('\n✨ All Phase 3 Auto Tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    // process.exit(1); // Don't exit yet so we can see the output in the tool
    throw error;
  }
}

main();
