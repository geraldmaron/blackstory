/**
 * The route table against the routes themselves.
 *
 * The gate is only fail-closed if every handler goes through it and every handler has a rule, and
 * both of those are properties of files rather than of a running request. So this walks
 * `src/app/admin/api/**` and compares what it finds with `ADMIN_ROUTE_RULES`: a new route with no
 * rule, a rule left behind by a deleted route, or a handler that authenticates without checking
 * authority all fail here rather than in production.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADMIN_ROUTE_RULES, STAFF_READ, findAdminRouteAccess } from './route-permissions';
import { permissionsForStaffRole } from './staff-permissions';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '../../app/admin/api');

const HANDLER_EXPORT = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;

type DiscoveredHandler = {
  readonly method: string;
  readonly pattern: string;
  readonly source: string;
  readonly file: string;
};

function routeFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === 'route.ts' ? [path] : [];
  });
}

/** `research-cases/[id]/assign/route.ts` becomes `/admin/api/research-cases/:id/assign`. */
function patternFor(file: string): string {
  const segments = relative(apiDir, dirname(file))
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => (segment.startsWith('[') ? `:${segment.slice(1, -1)}` : segment));
  return ['/admin/api', ...segments].join('/');
}

function discoverHandlers(): readonly DiscoveredHandler[] {
  return routeFiles(apiDir).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const pattern = patternFor(file);
    return [...source.matchAll(HANDLER_EXPORT)].map((match) => ({
      method: match[1] ?? '',
      pattern,
      source,
      file,
    }));
  });
}

const handlers = discoverHandlers();

test('every admin API handler has a rule in the route table', () => {
  assert.ok(handlers.length > 0, 'no admin API route handlers were found to check');
  const missing = handlers
    .filter((handler) => !findAdminRouteAccess(handler.method, handler.pattern))
    .map((handler) => `${handler.method} ${handler.pattern}`);
  assert.deepEqual(missing, []);
});

test('every admin API handler authorizes through the route gate', () => {
  const unguarded = handlers
    .filter(
      (handler) =>
        !handler.source.includes('authorizeAdminRoute(request)') ||
        handler.source.includes('authorizeAdminRequest('),
    )
    .map((handler) => relative(apiDir, handler.file));
  assert.deepEqual(unguarded, []);
});

test('the route table has no rule for a route that no longer exists', () => {
  const declared = new Set(handlers.map((handler) => `${handler.method} ${handler.pattern}`));
  const stale = ADMIN_ROUTE_RULES.filter(
    (rule) => !declared.has(`${rule.method} ${rule.pattern}`),
  ).map((rule) => `${rule.method} ${rule.pattern}`);
  assert.deepEqual(stale, []);
});

test('every declared permission exists in the staff role table', () => {
  const known = new Set(permissionsForStaffRole('admin'));
  const unknown = ADMIN_ROUTE_RULES.filter(
    (rule) => rule.access !== STAFF_READ && !known.has(rule.access),
  ).map((rule) => rule.access);
  assert.deepEqual(unknown, []);
});

test('a path the table does not cover resolves to nothing', () => {
  assert.equal(findAdminRouteAccess('POST', '/admin/api/catalog/apply'), undefined);
  assert.equal(findAdminRouteAccess('DELETE', '/admin/api/switches'), undefined);
  // Declared for POST only; reading it is not thereby declared.
  assert.equal(findAdminRouteAccess('GET', '/admin/api/catalog/bulk-decision'), undefined);
});

test('a literal path is not answered by a rule with a dynamic segment', () => {
  assert.equal(
    findAdminRouteAccess('POST', '/admin/api/research-cases/bulk-transition'),
    'research:write',
  );
  assert.equal(findAdminRouteAccess('GET', '/admin/api/research-cases/abc123'), STAFF_READ);
  assert.equal(
    findAdminRouteAccess('POST', '/admin/api/research-cases/abc123/promote'),
    'publication:publish',
  );
});

test('a dynamic segment does not match an empty or missing segment', () => {
  assert.equal(findAdminRouteAccess('POST', '/admin/api/research-cases//promote'), undefined);
  assert.equal(findAdminRouteAccess('POST', '/admin/api/research-cases/promote'), undefined);
});

test('the method is compared case-insensitively', () => {
  assert.equal(findAdminRouteAccess('get', '/admin/api/audit'), STAFF_READ);
  assert.equal(findAdminRouteAccess('post', '/admin/api/releases/stage'), 'publication:publish');
});
