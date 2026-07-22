/**
 * Metro applies babel-preset-expo automatically without this file present,
 * but jest-expo's babel-jest transform (used for `pnpm test`, not for the
 * app bundle) looks for an explicit babel.config.js — without it, Jest never
 * transforms react-native/expo ESM source and every test suite fails with
 * "Cannot use import statement outside a module".
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
