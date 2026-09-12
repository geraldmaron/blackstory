/**
 * What every admin API route requires, in one table.
 *
 * A rule names a method, the route's path (dynamic segments written `:name`), and the authority
 * the caller must hold: either `STAFF_READ` — any verified staff role may read the console's own
 * operational data — or one permission from the role table in `staff-permissions.ts`.
 *
 * A method and path with no rule resolves to nothing, and the request gate treats nothing as
 * denial. A new route is therefore unreachable until its authority is stated here, which is the
 * opposite of the default where an unlisted route inherits whatever the last author assumed.
 *
 * The table is pure data — no headers, no Supabase, no database — so it can be read by tests and
 * by anyone auditing the surface without standing up a request.
 */
import type { AdminPermission } from './server-authorization';

/**
 * Reading the console's own records. Every staff role holds it, so it grants nothing a signed-in
 * operator did not already have; read routes name it so that "declares nothing" stays a denial
 * rather than the way reads are spelled.
 */
export const STAFF_READ = 'staff:read';

export type AdminRouteAccess = typeof STAFF_READ | AdminPermission;

export type AdminRouteRule = {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Route path with dynamic segments as `:name`, matching the `[name]` directory it comes from. */
  readonly pattern: string;
  readonly access: AdminRouteAccess;
};

export const ADMIN_ROUTE_RULES: readonly AdminRouteRule[] = [
  { method: 'GET', pattern: '/admin/api/audit', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/auth/me', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/catalog/entity-ids', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/discovery/runs', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/graylist', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/releases', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/research-cases', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/research-cases/:id', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/sources', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/stories/packets', access: STAFF_READ },
  { method: 'GET', pattern: '/admin/api/switches', access: STAFF_READ },

  // A decision recorded against a whole filtered set of published entities. The release builder
  // reads the latest decision per entity, so the blast radius is the set rather than one field —
  // the same reason the workbench's bulk verbs sit behind `canonical:bulk_write`.
  {
    method: 'POST',
    pattern: '/admin/api/catalog/bulk-decision',
    access: 'canonical:bulk_write',
  },
  // Staging activate or rollback is the gate in front of what the public site serves. Rollback
  // rides the same rule: the role table grants `publication:retract` to exactly the roles it
  // grants `publication:publish`.
  { method: 'POST', pattern: '/admin/api/releases/stage', access: 'publication:publish' },
  { method: 'POST', pattern: '/admin/api/research-cases/:id/assign', access: 'research:write' },
  // Promotion turns a proposed record into a canonical one. It is an approver's act, which keeps
  // it away from `research:write` and the proposer who staged the case.
  {
    method: 'POST',
    pattern: '/admin/api/research-cases/:id/promote',
    access: 'publication:publish',
  },
  { method: 'POST', pattern: '/admin/api/research-cases/:id/transition', access: 'research:write' },
  {
    method: 'POST',
    pattern: '/admin/api/research-cases/bulk-transition',
    access: 'research:write',
  },
  {
    method: 'POST',
    pattern: '/admin/api/stories/packets/:submissionId/review',
    access: 'research:write',
  },
  { method: 'POST', pattern: '/admin/api/stories/packets/review-bulk', access: 'research:write' },
];

/** Denial for a method and path the table does not cover. */
export class AdminRouteUndeclaredError extends Error {
  readonly method: string;
  readonly pathname: string;

  constructor(method: string, pathname: string) {
    super('Admin route has no declared permission');
    this.name = 'AdminRouteUndeclaredError';
    this.method = method;
    this.pathname = pathname;
  }
}

function segmentsOf(path: string): readonly string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

function patternMatches(pattern: string, pathname: string): boolean {
  const patternSegments = segmentsOf(pattern);
  const pathSegments = segmentsOf(pathname);
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every((segment, index) => {
    const candidate = pathSegments[index] ?? '';
    return segment.startsWith(':') ? candidate.length > 0 : segment === candidate;
  });
}

/**
 * The access a method and path requires, or `undefined` when the table does not cover it.
 *
 * Literal rules are matched before rules with dynamic segments, so a fixed path such as
 * `/admin/api/research-cases/bulk-transition` can never be answered by a `:id` rule that happens
 * to have the same shape.
 */
export function findAdminRouteAccess(
  method: string,
  pathname: string,
): AdminRouteAccess | undefined {
  const wanted = method.toUpperCase();
  const candidates = ADMIN_ROUTE_RULES.filter((rule) => rule.method === wanted);
  const path = segmentsOf(pathname).join('/');
  const literal = candidates.find(
    (rule) => !rule.pattern.includes(':') && segmentsOf(rule.pattern).join('/') === path,
  );
  if (literal) return literal.access;
  return candidates.find((rule) => patternMatches(rule.pattern, pathname))?.access;
}
