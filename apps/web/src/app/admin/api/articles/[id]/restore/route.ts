import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialError, editorialBody } from '@/admin/editorial/http';
import { restoreArticle } from '@/admin/editorial/store';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = await authorizeAdminRoute(request),
      b = await editorialBody(request);
    return Response.json(
      await restoreArticle(
        a,
        (await params).id,
        Number(b.restoreRevision),
        Number(b.revision),
        String(b.reason ?? ''),
      ),
    );
  } catch (e) {
    return editorialError(e);
  }
}
