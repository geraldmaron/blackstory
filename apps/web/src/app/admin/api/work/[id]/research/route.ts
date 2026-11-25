import { sessionManagementResearch } from '@repo/operator-cli/management-session';
import type { WorkItem } from '@repo/ops-data/management/contracts';
import { authorizeAdminRoute } from '../../../../../../admin/auth/request-auth';
import { workActor, workStore, workError } from '../../../../../../admin/work/service';
import { notify } from '../../../../../../lib/notify/notify';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = workActor(await authorizeAdminRoute(request));
    const body: unknown = await request.json();
    const result = await sessionManagementResearch(
      workStore(),
      actor,
      (await context.params).id,
      body,
    );
    // An agent session just saved a proposal: the owner is the only one who can approve it.
    // shortcut: hosted-runner proposals (GitHub Actions) are saved outside this route and send no
    // alert; add one in the runner if hosted mode becomes routine.
    const work = (result as { work?: WorkItem | null }).work;
    const completed = (body as { action?: unknown } | null)?.action === 'complete';
    if (completed && work?.state === 'awaiting_review') {
      notify({
        event: 'owner.work_ready',
        to: 'owner',
        data: { workId: work.id, request: work.request.request },
        idempotencyKey: `owner.work_ready:${work.id}:${work.version}`,
      });
    }
    return Response.json(result);
  } catch (error) {
    return workError(error);
  }
}
