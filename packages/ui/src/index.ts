
/**
 * Shared UI primitives and design tokens for Blap web and admin applications.
 */

export const UI_PACKAGE = '@blap/ui' as const;

export * from './tokens/index.js';
export * from './components/index.js';
export * from './brand/index.js';
export { cx } from './utils/cx.js';
