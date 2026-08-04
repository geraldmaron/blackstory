/**
 * GET /api/catalog/entity-ids — every entity id matching a workbench query, ignoring pagination.
 *
 * Backs select-all-matching in the workbench so a bulk decision can address a whole filtered set
 * rather than only the rendered page. Accepts exactly the same query parameters as /catalog, so
 * the selection is guaranteed to be the set the operator is looking at.
 *
 * Read-only: it returns ids, never mutates. The bulk-decision route still authorizes and audits
 * the write separately.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../auth/request-auth';
import { parseEntityQuery } from '../../../../lib/entity-query-params';
import { queryMatchingEntityIds } from '../../../../lib/entity-query';

/**
 * Hard ceiling on one selection. Well above the largest real facet (3,195 places) but low enough
 * that a malformed query cannot pull the whole table into a request body.
 */
const MAX_SELECTION = 10_000;

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const query = parseEntityQuery(Object.fromEntries(url.searchParams.entries()));
    const ids = await queryMatchingEntityIds(query, MAX_SELECTION);
    return Response.json({
      ids,
      count: ids.length,
      // Tells the client its selection was clipped, so the UI can say so rather than silently
      // acting on a subset the operator believes is everything.
      truncated: ids.length === MAX_SELECTION,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
