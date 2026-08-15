/**
 * Re-export shim: implementation moved to @repo/domain-core/claims/measurements to break the
 * @repo/domain <-> @repo/security circular dependency. Keep this file so every existing
 * relative import of './claims/measurements.js' inside @repo/domain keeps working unchanged.
 */
export * from '@repo/domain-core/claims/measurements';
