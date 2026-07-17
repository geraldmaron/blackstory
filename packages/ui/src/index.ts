/**
 * Shared UI primitives and design tokens for Black Book web and admin applications.
 */

export const UI_PACKAGE = '@black-book/ui' as const;

export * from './tokens/index.js';
export * from './components/index.js';
export * from './brand/index.js';
export { cx } from './utils/cx.js';
