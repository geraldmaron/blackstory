import { authorizeAdminRoute } from '@/admin/auth/request-auth';
import { editorialError, editorialBody } from '@/admin/editorial/http';
import { archiveStory } from '@/admin/editorial/story-management';
import { readStory, saveStory } from '@/admin/editorial/store';
type Context = { params: Promise<{ id: string }> };
// Publication prepares and verifies the full signed catalog before atomic activation.
export const maxDuration = 800;
export async function GET(request: Request, { params }: Context) {
  try {
    await authorizeAdminRoute(request);
    const a = await readStory((await params).id);
    return a ? Response.json(a) : Response.json({ error: 'Story not found.' }, { status: 404 });
  } catch (e) {
    return editorialError(e);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const actor = await authorizeAdminRoute(request),
      b = await editorialBody(request),
      id = (await params).id;
    if ((b.draft as { id?: unknown })?.id !== id) throw new Error('Story identity does not match.');
    return Response.json(
      await saveStory(actor, b.draft, Number(b.revision), String(b.reason ?? '')),
    );
  } catch (e) {
    return editorialError(e);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const actor = await authorizeAdminRoute(request),
      body = await editorialBody(request);
    return Response.json(
      await archiveStory(
        actor,
        (await params).id,
        Number(body.revision),
        typeof body.publicReleaseId === 'string' ? body.publicReleaseId : null,
        body.confirmed === true,
        String(body.reason ?? ''),
      ),
    );
  } catch (error) {
    return editorialError(error);
  }
}
