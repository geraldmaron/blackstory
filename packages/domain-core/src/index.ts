/**
 * Barrel for @repo/domain-core: security-independent domain primitives shared by @repo/domain
 * and @repo/security. See package.json's description for why this package exists (breaking the
 * domain <-> security circular dependency).
 */
export * from './living.js';
export * from './era.js';
export * from './relationship.js';
export * from './claims/confidence.js';
export * from './claims/evidence-link.js';
export * from './claims/measurements.js';
export * from './provenance/rights.js';
export * from './graph/adjacency.js';
export * from './geography/precision.js';
export * from './learning-index/index.js';
