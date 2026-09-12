/**
 * Re-export shim: the implementation lives in @repo/domain-core/geography/display-radius.
 *
 * That package holds the domain primitives `@repo/security` needs. `@repo/security` must not
 * import `@repo/domain` — `@repo/domain` imports `@repo/security`, so the reverse edge would be a
 * cycle — and `@repo/domain-core` depends on neither, so both can read it.
 *
 * Keep this file so '@repo/domain/geography/display-radius', which apps/web imports, resolves.
 */
export * from '@repo/domain-core/geography/display-radius';
