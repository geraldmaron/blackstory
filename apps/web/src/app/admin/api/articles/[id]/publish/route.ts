import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialBody, editorialError } from '@/admin/editorial/http';
import { publishArticle } from '@/admin/editorial/publish';
// Publication prepares and verifies the full signed catalog before atomic activation.
export const maxDuration = 800;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminRoute(request),
      body = await editorialBody(request);
    return Response.json(
      await publishArticle(
        actor,
        (await params).id,
        Number(body.revision),
        String(body.reason ?? ''),
      ),
    );
  } catch (e) {
    return editorialError(e);
  }
}
