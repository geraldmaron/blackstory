import { authorizeAdminRoute } from '../../../../admin/auth/request-auth';
import { workActor, workStore, dispatchWork, workError } from '../../../../admin/work/service';
export async function GET(request: Request) {
  try {
    return Response.json({
      items: await workStore().list(workActor(await authorizeAdminRoute(request))),
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
        reviewUrl: `/admin/work/${work.id}`,
      },
      { status: 202 },
    );
  } catch (error) {
    return workError(error);
  }
}
