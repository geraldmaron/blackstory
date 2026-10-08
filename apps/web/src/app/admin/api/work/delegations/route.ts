import { authorizeAdminRoute } from '../../../../../admin/auth/request-auth';
import { manageDelegations } from '@repo/ops-data/management/delegations';
import { workActor, workStore, workError } from '../../../../../admin/work/service';
export async function GET(request: Request) {
  try {
    return Response.json({
      delegations: await manageDelegations(
        workStore(),
        workActor(await authorizeAdminRoute(request)),
      ),
    });
  } catch (error) {
    return workError(error);
  }
}
export async function POST(request: Request) {
  try {
    return Response.json({
      delegations: await manageDelegations(
        workStore(),
        workActor(await authorizeAdminRoute(request)),
        await request.json(),
      ),
    });
  } catch (error) {
    return workError(error);
  }
}
