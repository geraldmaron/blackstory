/**
 * Shared UI primitives and design tokens for BlackStory web and admin applications.
 */

export const UI_PACKAGE = '@repo/ui' as const;

export * from './tokens/index.js';
export * from './components/index.js';
export { cx } from './utils/cx.js';
