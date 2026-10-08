import { authorizeAdminRoute } from '../../../../../../admin/auth/request-auth';
import {
  workActor,
  workStore,
  dispatchWork,
  workError,
} from '../../../../../../admin/work/service';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = workActor(await authorizeAdminRoute(request));
    const id = (await context.params).id;
    const work = await workStore().get(actor, id);
    if (!work) return Response.json({ error: 'Work not found' }, { status: 404 });
    await workStore().retry(actor, id);
    return Response.json({
      dispatched: await dispatchWork(id),
      work: await workStore().get(actor, id),
    });
  } catch (error) {
    return workError(error);
  }
}
