/**
 * Extends the shared lint policy with Next.js Core Web Vitals rules for an application root.
 */
import nextPlugin from '@next/eslint-plugin-next';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import blackBookConfig from './index.js';

export default [
  ...blackBookConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
      // Registering the plugin makes its rules resolvable so existing
      // `eslint-disable-next-line react-hooks/exhaustive-deps` comments don't error with
      // "Definition for rule not found". Left off (not "warn") because turning it on surfaces
      // ~thousands of pre-existing dependency-array findings across the app that were never
      // triaged against this rule — a separate cleanup, not part of fixing the unknown-rule error.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
