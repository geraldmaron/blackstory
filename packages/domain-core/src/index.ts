/**
 * Barrel for @repo/domain-core: security-independent domain primitives shared by @repo/domain
 * and @repo/security. This package depends on @repo/schemas only, so @repo/security can read
 * these primitives without importing @repo/domain (which imports @repo/security).
 */
export * from './living.js';
export * from './era.js';
export * from './relationship.js';
export * from './claims/attribution.js';
export * from './claims/confidence.js';
export * from './claims/evidence-link.js';
export * from './claims/lineage.js';
export * from './claims/measurements.js';
export * from './claims/source-fitness.js';
export * from './research/deficits.js';
export * from './research/maturity.js';
export * from './provenance/rights.js';
export * from './graph/adjacency.js';
export * from './geography/precision.js';
export * from './learning-index/index.js';
