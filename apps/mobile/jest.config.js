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
    '^@repo/public-contracts/version$': path.join(publicContractsSrc, 'version.ts'),
    '^@repo/public-contracts/errors$': path.join(publicContractsSrc, 'errors.ts'),
    '^@repo/public-contracts/v1/(.*)$': path.join(publicContractsSrc, 'v1', '$1.ts'),
    // file: linked public-contracts has no nested node_modules in CI; resolve zod from mobile.
    '^zod$': require.resolve('zod'),
    // Reanimated boots a native Worklets runtime on import, which does not exist under Jest.
    '^react-native-reanimated$': path.join(__dirname, 'test/mocks/react-native-reanimated.js'),
  },
  // Resolve NodeNext-style `.js` specifiers inside public-contracts source to `.ts`.
  resolver: path.join(__dirname, 'jest.resolver.cjs'),
};
