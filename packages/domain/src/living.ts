/**
 * Re-export shim: implementation moved to @repo/domain-core/living to break the
 * @repo/domain <-> @repo/security circular dependency (this module has no security-specific
 * logic and @repo/security needs it directly). Keep this file so every existing relative import
 * of './living.js' inside @repo/domain keeps working unchanged.
 */
export * from '@repo/domain-core/living';
