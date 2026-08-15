/**
 * Re-export shim: implementation moved to @repo/domain-core/era to break the
 * @repo/domain <-> @repo/security circular dependency. Keep this file so every existing
 * relative import of './era.js' inside @repo/domain keeps working unchanged.
 */
export * from '@repo/domain-core/era';
