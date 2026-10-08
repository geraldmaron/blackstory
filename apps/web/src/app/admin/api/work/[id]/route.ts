import { authorizeAdminRoute } from '../../../../../admin/auth/request-auth';
import { workActor, workStore, workError } from '../../../../../admin/work/service';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = workActor(await authorizeAdminRoute(request));
    const work = await workStore().get(actor, (await context.params).id);
    return work
      ? Response.json({ work })
      : Response.json({ error: 'Work not found' }, { status: 404 });
  } catch (error) {
    return workError(error);
  }
}
