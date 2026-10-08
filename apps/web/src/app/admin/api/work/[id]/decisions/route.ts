import { authorizeAdminRoute } from '../../../../../../admin/auth/request-auth';
import { workExecutionMode } from '@repo/ops-data/management/contracts';
import {
  workActor,
  workStore,
  dispatchWork,
  workError,
} from '../../../../../../admin/work/service';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = workActor(await authorizeAdminRoute(request));
    const work = await workStore().decide(actor, (await context.params).id, await request.json());
    const dispatched =
      work.state === 'approved' || work.state === 'queued' ? await dispatchWork(work.id) : false;
    return Response.json({
      work: await workStore().get(actor, work.id),
      dispatched,
      nextAction:
        workExecutionMode(work.request) === 'session' && work.state === 'approved'
          ? 'publish_from_authorized_session'
          : 'inspect_work',
    });
  } catch (error) {
    return workError(error);
  }
}
