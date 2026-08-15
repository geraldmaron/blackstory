/**
 * Re-export shim: implementation moved to @repo/domain-core/geography/precision to break the
 * @repo/domain <-> @repo/security circular dependency. Keep this file so every existing
 * relative import of './geography/precision.js' inside @repo/domain keeps working unchanged.
 */
export * from '@repo/domain-core/geography/precision';
