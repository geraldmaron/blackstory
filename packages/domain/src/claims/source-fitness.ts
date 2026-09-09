/**
 * Re-export shim: implementation lives in @repo/domain-core/claims/source-fitness. Claim-relative
 * source fitness is a primitive both @repo/domain and @repo/security need, so it sits in
 * domain-core for the same reason the confidence engine does.
 */
export * from '@repo/domain-core/claims/source-fitness';
