/**
 * Re-export shim: the implementation lives in @repo/domain-core/claims/evidence-link.
 *
 * That package holds the domain primitives `@repo/security` needs. `@repo/security` must not
 * import `@repo/domain` — `@repo/domain` imports `@repo/security`, so the reverse edge would be a
 * cycle — and `@repo/domain-core` depends on neither, so both can read it.
 *
 * Keep this file so relative imports of './claims/evidence-link.js' inside @repo/domain resolve.
 */
export * from '@repo/domain-core/claims/evidence-link';
