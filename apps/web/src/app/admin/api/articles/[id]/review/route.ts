import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialError, editorialBody } from '@/admin/editorial/http';
import { reviewArticle } from '@/admin/editorial/store';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = await authorizeAdminRoute(request),
      b = await editorialBody(request);
    return Response.json(
      await reviewArticle(
        a,
        (await params).id,
        Number(b.revision),
        String(b.decision),
        String(b.reason ?? ''),
        (b.checks ?? {}) as Record<string, boolean>,
      ),
    );
  } catch (e) {
    return editorialError(e);
  }
}
