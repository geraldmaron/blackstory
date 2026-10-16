// apps/site is an Expo project outside the pnpm workspace, like apps/mobile: it uses Expo's own
// maintained config (`eslint-config-expo`) instead of the Next/Node-tuned root `@repo/eslint-config`.
// Server and test files are CommonJS on purpose (expo-server's ESM build has extensionless imports).
const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*'] },
  {
    files: ['**/*.cjs', 'metro.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Tamagui's documented module augmentation is an empty interface extending the app config.
    files: ['tamagui.config.ts'],
    rules: { '@typescript-eslint/no-empty-object-type': 'off' },
  },
]);
