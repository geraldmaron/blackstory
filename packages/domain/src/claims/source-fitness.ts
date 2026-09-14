/**
 * Re-export shim: the implementation lives in @repo/domain-core/claims/source-fitness.
 * Claim-relative source fitness sits there because @repo/domain-core is the package both
 * @repo/domain and @repo/security may depend on.
 */
export * from '@repo/domain-core/claims/source-fitness';
