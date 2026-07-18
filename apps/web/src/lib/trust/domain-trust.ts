/**
 * Re-exports the domain trust surface for apps/web.
 * Uses the client-safe `@blap/domain/trust` subpath — never the package barrel
 * (barrel pulls `publication/` → `node:crypto` into browser clients).
 */
export * from '@blap/domain/trust';
