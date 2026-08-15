/**
 * Re-export shim: implementation moved to @repo/domain-core/learning-index to break the
 * @repo/domain <-> @repo/security circular dependency. Keep this file so every existing
 * relative import of './learning-index/index.js' inside @repo/domain keeps working unchanged.
 */
export * from '@repo/domain-core/learning-index';
