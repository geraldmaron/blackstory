/**
 * Re-export shim: implementation moved to @repo/domain-core/graph/adjacency to break the
 * @repo/domain <-> @repo/security circular dependency. Keep this file so every existing
 * relative import of './graph/adjacency.js' inside @repo/domain keeps working unchanged.
 */
export * from '@repo/domain-core/graph/adjacency';
