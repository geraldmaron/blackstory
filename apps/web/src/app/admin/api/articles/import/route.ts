import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialBody, editorialError } from '@/admin/editorial/http';
import { importStoryPacket } from '@/admin/editorial/packet';
export async function POST(request: Request) {
  try {
    const actor = await authorizeAdminRoute(request),
      body = await editorialBody(request);
    return Response.json(await importStoryPacket(actor, String(body.submissionId ?? '')));
  } catch (e) {
    return editorialError(e);
  }
}
