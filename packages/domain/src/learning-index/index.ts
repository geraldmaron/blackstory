/**
 * Re-export shim: the implementation lives in @repo/domain-core/learning-index.
 *
 * That package holds the domain primitives `@repo/security` needs. `@repo/security` must not
 * import `@repo/domain` — `@repo/domain` imports `@repo/security`, so the reverse edge would be a
 * cycle — and `@repo/domain-core` depends on neither, so both can read it.
 *
 * Keep this file so relative imports of './learning-index/index.js' inside @repo/domain resolve.
 */
export * from '@repo/domain-core/learning-index';
