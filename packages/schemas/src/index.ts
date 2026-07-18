/**
 * Shared JSON Schema Zod contracts for APIs, workers, and clients.
 * Product constitution is the versioned policy source of truth.
 */
export const SCHEMAS_PACKAGE = '@repo/schemas' as const;

export * from './constitution/index.js';
