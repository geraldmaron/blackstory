/**
 * Server-side operations dashboard helpers: queue counts from Postgres stores
 * and non-secret environment posture for the admin home screen.
 */
import { queryIntakeItemPage } from '../lib/postgres-submissions';
import { tryCountAdminResearchCases } from '../cases/research-case-store';
import { listStoryPackets, type StoryPacketListItem } from '../stories/story-packet-store';

export type OpsQueueSource = 'live' | 'unavailable';

export type OpsQueueSummary = {
  readonly submissionsSource: OpsQueueSource;
  readonly submissionsPending?: number;
  readonly researchCaseSource: OpsQueueSource;
  readonly storyPacketsSource: OpsQueueSource;
  readonly researchCasePending?: number;
  readonly storyPacketsPending?: number;
  readonly storyPacketsTotal?: number;
};

export type OpsEnvironment = {
  readonly appEnv: string;
  readonly dataSource: string;
  readonly authMode: string;
  readonly productionBreakGlass: boolean;
};

/** Count story packets awaiting human review (no review record yet). */
export function countPendingStoryPackets(items: readonly Pick<StoryPacketListItem, 'review'>[]): {
  readonly pending: number;
  readonly total: number;
} {
  let pending = 0;
  for (const item of items) {
    if (!item.review) pending += 1;
  }
  return { pending, total: items.length };
}

export async function loadOpsQueueSummary(): Promise<OpsQueueSummary> {
  const [research, story, submissions] = await Promise.all([
    loadResearchCaseQueueSummary(),
    loadStoryPacketQueueSummary(),
    queryIntakeItemPage({ statuses: ['quarantined'], pageSize: 1 }).catch(() => null),
  ]);
  return {
    submissionsSource: submissions ? 'live' : 'unavailable',
    ...(submissions ? { submissionsPending: submissions.total } : {}),
    researchCaseSource: research.researchCaseSource,
    storyPacketsSource: story.storyPacketsSource,
    ...(research.researchCasePending !== undefined
      ? { researchCasePending: research.researchCasePending }
      : {}),
    ...(story.storyPacketsPending !== undefined
      ? { storyPacketsPending: story.storyPacketsPending }
      : {}),
    ...(story.storyPacketsTotal !== undefined
      ? { storyPacketsTotal: story.storyPacketsTotal }
      : {}),
  };
}

async function loadResearchCaseQueueSummary(): Promise<
  Pick<OpsQueueSummary, 'researchCasePending' | 'researchCaseSource'>
> {
  const pending = await tryCountAdminResearchCases([
    'candidate',
    'relevance_review',
    'insufficient_evidence',
  ]);
  if (pending === null) {
    return { researchCaseSource: 'unavailable' };
  }
  return {
    researchCasePending: pending,
    researchCaseSource: 'live',
  };
}

async function loadStoryPacketQueueSummary(): Promise<
  Pick<OpsQueueSummary, 'storyPacketsPending' | 'storyPacketsTotal' | 'storyPacketsSource'>
> {
  try {
    const items = await listStoryPackets(200);
    const { pending, total } = countPendingStoryPackets(items);
    return {
      storyPacketsPending: pending,
      storyPacketsTotal: total,
      storyPacketsSource: 'live',
    };
  } catch (error) {
    console.error('admin ops storyPackets summary failed', error);
    return { storyPacketsSource: 'unavailable' };
  }
}

export function loadOpsEnvironment(): OpsEnvironment {
  return {
    appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
    dataSource: 'Supabase/Postgres',
    authMode: 'supabase',
    productionBreakGlass: process.env.APP_RELEASE_ALLOW_PRODUCTION === '1',
  };
}
