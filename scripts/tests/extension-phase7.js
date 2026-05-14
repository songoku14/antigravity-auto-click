const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { normalizeConfig } = require('../../src/core/config-schema');
const { validateConfigField } = require('../../src/extension/config-service');

/**
 * Test case: Legacy configuration normalization
 */
function testLegacyNormalization() {
  console.log('Testing Legacy Normalization...');
  
  const legacyConfig = {
    pollInterval: 5000,
    performClickAutoAccept: true,
    blacklist: ['dangerous command'],
    autoAccept: {
      categories: {
        review: {
          enabled: true,
          patterns: ['test-pattern']
        }
      }
    }
  };

  const normalized = normalizeConfig(legacyConfig);

  // Check timing normalization
  assert.strictEqual(normalized.autoRetry.timing.pollInterval, 5000);
  
  // Check performClick normalization
  assert.strictEqual(normalized.autoAccept.performClick, true);
  
  // Check blacklist normalization
  assert.ok(normalized.autoAccept.blacklist.includes('dangerous command'));
  
  // Check category normalization (review -> reviewChange)
  assert.ok(normalized.autoAccept.categories.reviewChange);
  assert.strictEqual(normalized.autoAccept.categories.reviewChange.enabled, true);
  assert.ok(normalized.autoAccept.categories.reviewChange.context.includes('test-pattern'));

  console.log('✅ Legacy normalization tests passed');
}

/**
 * Test case: Configuration validation
 */
function testValidation() {
  console.log('Testing Validation Rules...');

  // Valid number
  validateConfigField('autoRetry.timing.pollInterval', 500);
  
  // Invalid number (negative)
  try {
    validateConfigField('autoRetry.timing.pollInterval', -10);
    assert.fail('Should have thrown for negative number');
  } catch (e) {
    assert.ok(e.message.includes('must be a positive number'));
  }

  // Invalid number (too small pollInterval)
  try {
    validateConfigField('autoRetry.timing.pollInterval', 50);
    assert.fail('Should have thrown for pollInterval < 100');
  } catch (e) {
    assert.ok(e.message.includes('must be at least 100ms'));
  }

  // Valid regex
  validateConfigField('autoRetry.customRetryPatterns', ['^error$', 'busy']);

  // Invalid regex
  try {
    validateConfigField('autoRetry.customRetryPatterns', ['[']);
    assert.fail('Should have thrown for invalid regex');
  } catch (e) {
    assert.ok(e.message.includes('Invalid regular expression'));
  }

  console.log('✅ Validation rules tests passed');
}

/**
 * Test case: Edge cases
 */
function testEdgeCases() {
  console.log('Testing Edge Cases...');

  // Empty/Missing config
  const emptyNormalized = normalizeConfig({});
  assert.strictEqual(emptyNormalized.autoRetry.enabled, true);
  assert.strictEqual(emptyNormalized.autoAccept.enabled, false);

  // Corrupted JSON (handled by config-service logic which calls normalizeConfig with {})
  const corruptedNormalized = normalizeConfig(null);
  assert.strictEqual(corruptedNormalized.autoRetry.enabled, true);

  console.log('✅ Edge case tests passed');
}

async function main() {
  try {
    testLegacyNormalization();
    testValidation();
    testEdgeCases();
    console.log('\n✨ All Phase 7 Regression & Compatibility Tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
