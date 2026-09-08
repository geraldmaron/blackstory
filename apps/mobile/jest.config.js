const path = require('path');
const publicContractsSrc = path.resolve(__dirname, '../../packages/public-contracts/src');

module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/ios/', '/android/'],
  // decode-uri-component@0.5.0 (Dependabot fix for a ReDoS) ships pure ESM, as do its siblings
  // split-on-first and filter-obj; expo-router's query-string dependency chain pulls all three
  // in at runtime. jest-expo's default transformIgnorePatterns skips node_modules outside its
  // own allowlist, so Jest hit raw `export default` syntax instead of transforming it. Extend
  // the allowlist rather than replace it, so the rest of the preset's behavior is unchanged.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|decode-uri-component|split-on-first|filter-obj))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  moduleNameMapper: {
    // Every public-contracts export maps to `./src/<subpath>.ts`, so this is one rule rather than
    // a hand-kept list. The list version silently failed to resolve each new export until someone
    // added a line here, which is a mirror of the package's own exports map and drifts the same
    // way every other mirror in this repo has.
    '^@repo/public-contracts/(.+)$': path.join(publicContractsSrc, '$1.ts'),
    // file: linked public-contracts has no nested node_modules in CI; resolve zod from mobile.
    '^zod$': require.resolve('zod'),
    // Reanimated boots a native Worklets runtime on import, which does not exist under Jest.
    '^react-native-reanimated$': path.join(__dirname, 'test/mocks/react-native-reanimated.js'),
    // MapLibre ships untransformed native-component modules, so importing it under Jest throws
    // "Cannot use import statement outside a module". Any suite reaching MapScreen transitively
    // (the record page embeds a still map plate) needs this; suites asserting camera calls still
    // declare their own jest.mock factory, which takes precedence.
    '^@maplibre/maplibre-react-native$': path.join(
      __dirname,
      'test/mocks/maplibre-react-native.js',
    ),
  },
  // Resolve NodeNext-style `.js` specifiers inside public-contracts source to `.ts`.
  resolver: path.join(__dirname, 'jest.resolver.cjs'),
};
