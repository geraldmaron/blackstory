/**
 * GET /api/research-cases — list research cases with optional state filter.
 */
import type { ResearchCaseState } from '@repo/domain';
import { authorizeAdminRoute, authErrorResponse } from '../../../../admin/auth/request-auth';
import { ALL_CASE_STATES, INBOX_CASE_STATES } from '../../../../admin/cases/research-case-types';
import { listAdminResearchCases } from '../../../../admin/cases/research-case-store';

export async function GET(request: Request): Promise<Response> {
  try {
    await authorizeAdminRoute(request);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const stateParam = url.searchParams.get('states') ?? 'inbox';

    let states: readonly ResearchCaseState[];
    if (stateParam === 'inbox') {
      states = INBOX_CASE_STATES;
    } else if (stateParam === 'all') {
      states = ALL_CASE_STATES;
    } else {
      states = stateParam
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is ResearchCaseState =>
          (ALL_CASE_STATES as readonly string[]).includes(value),
        );
    }

    const items = await listAdminResearchCases({ states, limit });
    return Response.json({ items, count: items.length });
  } catch (error) {
    return authErrorResponse(error);
  }
}
