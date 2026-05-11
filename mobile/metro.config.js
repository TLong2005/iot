// Shim `assert` — gói npm `assert` thường thiếu `build/assert.js` nếu không chạy prepare.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const shimAssert = path.resolve(__dirname, 'assert-shim.js');
const shimAssertPackageRoot = path.resolve(__dirname, 'shims/assert');
const upstreamResolve = config.resolver.resolveRequest;

// Prefer local shim over npm `assert` — hierarchical node_modules is checked before this,
// so a broken `node_modules/assert` must not be installed (removed from package.json).
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  assert: shimAssertPackageRoot,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'assert' || moduleName === 'assert/strict') {
    return {
      type: 'sourceFile',
      filePath: shimAssert,
    };
  }
  if (upstreamResolve) {
    return upstreamResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
