import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialError, editorialBody } from '@/admin/editorial/http';
import { listArticles, saveArticle } from '@/admin/editorial/store';
export async function GET(request: Request) {
  try {
    await authorizeAdminRoute(request);
    return Response.json({ items: await listArticles() });
  } catch (e) {
    return editorialError(e);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await authorizeAdminRoute(request),
      b = await editorialBody(request);
    return Response.json(await saveArticle(actor, b.draft, 0, String(b.reason ?? '')));
  } catch (e) {
    return editorialError(e);
  }
}
