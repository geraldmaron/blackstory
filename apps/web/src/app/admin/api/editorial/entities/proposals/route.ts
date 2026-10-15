import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialBody, editorialError } from '@/admin/editorial/http';
import { proposeEntityEditorial } from '@/admin/editorial/entities';
export async function POST(request: Request) {
  try {
    const actor = await authorizeAdminRoute(request),
      body = await editorialBody(request);
    return Response.json(
      await proposeEntityEditorial(actor, body.proposal, String(body.reason ?? '')),
    );
  } catch (e) {
    return editorialError(e);
  }
}
