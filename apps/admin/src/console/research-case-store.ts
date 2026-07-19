/**
 * Compatibility bridge: console surfaces still import console/research-case-store.
 * Live triage UX now lives under /inbox and /cases; this module keeps list helpers.
 */
import type { ConsoleFixtureRow } from './model';
import {
  getAdminResearchCaseDetail,
  listAdminResearchCases,
  tryListAdminResearchCases,
} from '../cases/research-case-store';
import { stateLabel } from '../cases/research-case-types';

export type ResearchCaseListItem = {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly candidateId?: string;
  readonly updatedAt: string;
  readonly createdAt: string;
};

export type ResearchCaseDetail = Awaited<ReturnType<typeof getAdminResearchCaseDetail>>;

export async function listResearchCasesForConsole(
  limit = 100,
): Promise<readonly ResearchCaseListItem[]> {
  const items = await listAdminResearchCases({
    states: ['candidate', 'relevance_review'],
    limit,
  });
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    state: item.state,
    ...(item.candidateId ? { candidateId: item.candidateId } : {}),
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
  }));
}

export async function getResearchCaseDetail(id: string) {
  return getAdminResearchCaseDetail(id);
}

export function researchCasesToConsoleRows(
  items: readonly ResearchCaseListItem[],
): readonly ConsoleFixtureRow[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    status: stateLabel(item.state as Parameters<typeof stateLabel>[0]),
    detail: [
      item.candidateId ? `submission ${item.candidateId}` : null,
      item.updatedAt ? `updated ${item.updatedAt}` : null,
      'private research case · not published',
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

export async function tryListConsoleResearchCaseRows(
  limit = 100,
): Promise<readonly ConsoleFixtureRow[] | null> {
  const items = await tryListAdminResearchCases({
    states: ['candidate', 'relevance_review'],
    limit,
  });
  if (items === null) return null;
  return researchCasesToConsoleRows(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      state: item.state,
      ...(item.candidateId ? { candidateId: item.candidateId } : {}),
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
    })),
  );
}
