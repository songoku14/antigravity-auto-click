const assert = require('assert');
const configService = require('../../src/extension/config-service');
const { DEFAULT_CONFIG } = require('../../src/core/config-schema');

function testValidation() {
  console.log('Testing Phase 4 config validation logic...');

  // 1. Test String List Validation (for blacklist)
  console.log('  - Testing string lists (blacklist)...');
  // Note: We need to implement string-list validation in config-service.js
  try {
    configService.validateConfigField('autoAccept.blacklist', 'not-an-array');
    assert.fail('Should have thrown for non-array blacklist');
  } catch (e) {
    assert.ok(e.message.includes('must be an array of strings'));
  }

  // 2. Test Category Enabled (boolean)
  console.log('  - Testing category enabled (boolean)...');
  // configService.validateConfigField('autoAccept.categories.terminal.enabled', true); 
  // No explicit validation for boolean yet in config-service, but good to check if it crashes

  // 3. Test Category Patterns (pattern-list)
  console.log('  - Testing category patterns (pattern-list)...');
  try {
    configService.validateConfigField('autoAccept.categories.terminal.buttons', ['[invalid(']);
    assert.fail('Should have thrown for invalid regex in category buttons');
  } catch (e) {
    assert.ok(e.message.includes('Invalid regular expression'));
  }

  console.log('✅ Validation tests passed (once implemented)');
}

function testCategoryUpdates() {
  console.log('Testing category updates...');
  
  // Modify a category
  configService.updateConfig((config) => {
    config.autoAccept.categories.terminal.enabled = false;
    config.autoAccept.categories.reviewChange.buttons = ['Custom Button'];
    return config;
  });

  const config = configService.readConfig();
  assert.strictEqual(config.autoAccept.categories.terminal.enabled, false);
  assert.deepStrictEqual(config.autoAccept.categories.reviewChange.buttons, ['Custom Button']);

  console.log('✅ Category update tests passed');
}

function testResetAutoAccept() {
  console.log('Testing resetConfigBlock for autoAccept...');
  
  // Modify config
  configService.updateConfig((config) => {
    config.autoAccept.enabled = false;
    config.autoAccept.performClick = true;
    config.autoAccept.categories.terminal.enabled = false;
    return config;
  });

  // Reset block
  configService.resetConfigBlock('autoAccept');
  
  const config = configService.readConfig();
  assert.strictEqual(config.autoAccept.enabled, DEFAULT_CONFIG.autoAccept.enabled);
  assert.strictEqual(config.autoAccept.performClick, DEFAULT_CONFIG.autoAccept.performClick);
  assert.strictEqual(config.autoAccept.categories.terminal.enabled, DEFAULT_CONFIG.autoAccept.categories.terminal.enabled);

  console.log('✅ resetConfigBlock(autoAccept) tests passed');
}

function main() {
  try {
    testValidation();
    testCategoryUpdates();
    testResetAutoAccept();
    console.log('\n✨ All Phase 4 Auto Tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    throw error;
  }
}

main();
