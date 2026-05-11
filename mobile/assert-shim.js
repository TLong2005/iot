/**
 * Polyfill `assert` cho Metro — gói npm `assert` đôi khi thiếu `build/`
 * (@ide/backoff / expo-notifications).
 */
function assertFn(condition, message) {
  if (!condition) {
    const err = new Error(message || 'Assertion failed');
    err.name = 'AssertionError';
    throw err;
  }
}

assertFn.ok = assertFn;
assertFn.equal = (actual, expected, message) => {
  if (actual != expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
};
assertFn.strictEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
};
assertFn.fail = (message) => {
  throw new Error(message || 'assert.fail');
};

module.exports = assertFn;
module.exports.default = assertFn;
module.exports.strict = assertFn;
