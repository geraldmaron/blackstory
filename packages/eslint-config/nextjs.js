/**
 * Extends the shared lint policy with Next.js Core Web Vitals rules for an application root.
 */
import nextPlugin from '@next/eslint-plugin-next';
import blackBookConfig from './index.js';

export default [
  ...blackBookConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
