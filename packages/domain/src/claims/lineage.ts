/**
 * Re-export shim: implementation lives in @repo/domain-core/claims/lineage so that
 * @repo/security and @repo/domain can both resolve source lineage without the circular
 * dependency. Keep this file so relative imports of './claims/lineage.js' inside
 * @repo/domain keep working unchanged.
 */
export * from '@repo/domain-core/claims/lineage';
