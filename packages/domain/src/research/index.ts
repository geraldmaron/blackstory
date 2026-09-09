/**
 * Re-export shim: the research maturity and deficit model lives in @repo/domain-core/research
 * so that @repo/security and @repo/domain can both read it without the circular dependency.
 */
export * from '@repo/domain-core/research/deficits';
export * from '@repo/domain-core/research/maturity';
