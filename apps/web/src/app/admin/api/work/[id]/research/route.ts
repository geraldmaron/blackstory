import { sessionManagementResearch } from '@repo/operator-cli/management-session';
import { authorizeAdminRoute } from '../../../../../../admin/auth/request-auth';
import { workActor, workStore, workError } from '../../../../../../admin/work/service';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = workActor(await authorizeAdminRoute(request));
    return Response.json(
      await sessionManagementResearch(
        workStore(),
        actor,
        (await context.params).id,
        await request.json(),
      ),
    );
  } catch (error) {
    return workError(error);
  }
}
