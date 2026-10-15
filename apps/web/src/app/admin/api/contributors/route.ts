import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialError, editorialBody } from '@/admin/editorial/http';
import { listContributors, saveContributor } from '@/admin/editorial/store';
import type { EditorialContributor } from '@repo/schemas';
export async function GET(request: Request) {
  try {
    await authorizeAdminRoute(request);
    return Response.json({ items: await listContributors() });
  } catch (e) {
    return editorialError(e);
  }
}
export async function POST(request: Request) {
  try {
    const a = await authorizeAdminRoute(request),
      b = await editorialBody(request);
    return Response.json({
      id: await saveContributor(
        a,
        b.profile as EditorialContributor & { linkToMe?: boolean },
        String(b.reason ?? ''),
      ),
    });
  } catch (e) {
    return editorialError(e);
  }
}
