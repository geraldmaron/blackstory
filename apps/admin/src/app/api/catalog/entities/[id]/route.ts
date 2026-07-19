/**
 * GET /api/catalog/entities/[id] — canonical entity detail with locations subcollection.
 */
import { authorizeAdminRequest, authErrorResponse } from '../../../../../auth/request-auth';
import { getCanonicalEntityDetail } from '../../../../../catalog/catalog-store';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await authorizeAdminRequest(request.headers);
    const { id } = await context.params;
    const item = await getCanonicalEntityDetail(id);
    if (!item) {
      return Response.json({ error: `Canonical entity not found: ${id}` }, { status: 404 });
    }
    return Response.json({ item });
  } catch (error) {
    return authErrorResponse(error);
  }
}
