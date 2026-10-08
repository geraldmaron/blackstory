import { authorizeAdminRoute } from '../../../../admin/auth/request-auth';
import { workExecutionMode } from '@repo/ops-data/management/contracts';
import {
  workActor,
  workStore,
  dispatchWork,
  workError,
  workCapabilities,
} from '../../../../admin/work/service';
export async function GET(request: Request) {
  try {
    return Response.json({
      items: await workStore().list(workActor(await authorizeAdminRoute(request))),
      capabilities: workCapabilities(),
    });
  } catch (error) {
    return workError(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = workActor(await authorizeAdminRoute(request));
    const work = await workStore().submit(actor, await request.json());
    const dispatched = await dispatchWork(work.id);
    return Response.json(
      {
        work: await workStore().get(actor, work.id),
        dispatched,
        executionMode: workExecutionMode(work.request),
        nextAction:
          workExecutionMode(work.request) === 'session'
            ? 'research_in_session'
            : 'inspect_dispatch_status',
        reviewUrl: `/admin/work/${work.id}`,
      },
      { status: 202 },
    );
  } catch (error) {
    return workError(error);
  }
}
