/**
 * Re-export shim: implementation moved to @repo/domain-core/claims/confidence to break the
 * @repo/domain <-> @repo/security circular dependency. Keep this file so every existing
 * relative import of './claims/confidence.js' inside @repo/domain keeps working unchanged.
 */
export * from '@repo/domain-core/claims/confidence';
