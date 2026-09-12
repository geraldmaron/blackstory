/**
 * GET /api/research-cases/[id] — full research case detail for the portal sheet/page.
 */
import { authorizeAdminRoute, authErrorResponse } from '../../../../../admin/auth/request-auth';
import { getAdminResearchCaseDetail } from '../../../../../admin/cases/research-case-store';
import { legalActionsForState } from '../../../../../admin/cases/research-case-types';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await authorizeAdminRoute(request);
    const { id } = await context.params;
    const detail = await getAdminResearchCaseDetail(id);
    if (!detail) {
      return Response.json({ error: `Research case not found: ${id}` }, { status: 404 });
    }
    return Response.json({
      item: detail,
      legalActions: legalActionsForState(detail.state),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
