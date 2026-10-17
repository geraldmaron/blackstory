import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialBody, editorialError } from '@/admin/editorial/http';
import { unarchiveStory } from '@/admin/editorial/story-management';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminRoute(request),
      body = await editorialBody(request);
    return Response.json(
      await unarchiveStory(
        actor,
        (await params).id,
        Number(body.revision),
        String(body.reason ?? ''),
      ),
    );
  } catch (error) {
    return editorialError(error);
  }
}
