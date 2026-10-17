/**
 * GET /admin/api/queue-counts — pending sizes of the queues the sidebar badges.
 *
 * Read-only and counts only: no row bodies leave the database. Each source degrades on its own,
 * so a slow table costs one badge, not the shell.
 */
import { authorizeAdminRoute, authErrorResponse } from '../../../../admin/auth/request-auth';
import { loadOpsQueueSummary } from '../../../../admin/ops/ops-summary';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRoute(request);
    const summary = await loadOpsQueueSummary();
    return Response.json({
      submissions: summary.submissionsSource === 'live' ? (summary.submissionsPending ?? 0) : null,
      inbox: summary.researchCaseSource === 'live' ? (summary.researchCasePending ?? 0) : null,
      storyReview:
        summary.storyPacketsSource === 'live' ? (summary.storyPacketsPending ?? 0) : null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
