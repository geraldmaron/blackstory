/**
 * GET /api/switches — list operational kill switches.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../auth/request-auth';
import { listKillSwitches } from '../../../ops/switches-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const items = await listKillSwitches(limit);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
