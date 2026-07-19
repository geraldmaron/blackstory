// apps/mobile (MOB-006) is an Expo / React Native project, not a Next.js/Node
// one: it uses `require()` for RN asset imports (images, fonts — an
// idiomatic RN pattern, not a style violation) and other RN-only idioms the
// root `@repo/eslint-config` (tuned for this monorepo's Next.js/Node apps)
// was never built to allow. ESLint's flat config resolves upward from a
// file's directory to the nearest config, so this file — not the root
// `eslint.config.mjs` — governs everything under apps/mobile. It uses
// Expo's own maintained config (`eslint-config-expo`), matching the
// dependency's SDK pin.
const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'ios/*', 'android/*'],
  },
]);
