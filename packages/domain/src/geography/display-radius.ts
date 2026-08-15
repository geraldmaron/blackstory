/**
 * Re-export shim: implementation moved to @repo/domain-core/geography/display-radius to break
 * the @repo/domain <-> @repo/security circular dependency. Keep this file so every existing
 * import of '@repo/domain/geography/display-radius' (apps/web) and './display-radius.js'
 * (@repo/domain-core/geography/precision.ts) keeps working unchanged.
 */
export * from '@repo/domain-core/geography/display-radius';
