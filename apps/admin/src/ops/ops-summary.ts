/**
 * Server-side operations dashboard helpers: queue counts from Admin SDK stores
 * and non-secret environment posture for the admin home screen.
 */
import { tryListAdminResearchCases } from '../cases/research-case-store';
import { adminPublicSiteOrigin } from '../lib/sibling-origins';
import { listStoryPackets, type StoryPacketListItem } from '../stories/story-packet-store';

export type OpsQueueSource = 'live' | 'unavailable';

export type OpsQueueSummary = {
  readonly researchCaseSource: OpsQueueSource;
  readonly storyPacketsSource: OpsQueueSource;
  readonly researchCasePending?: number;
  readonly storyPacketsPending?: number;
  readonly storyPacketsTotal?: number;
};

export type OpsEnvironment = {
  readonly appEnv: string;
  readonly firebaseProjectId: string;
  readonly authMode: string;
  readonly publicSiteOrigin: string | null;
  readonly productionBreakGlass: boolean;
};

/** Count story packets awaiting human review (no review record yet). */
export function countPendingStoryPackets(
  items: readonly Pick<StoryPacketListItem, 'review'>[],
): { readonly pending: number; readonly total: number } {
  let pending = 0;
  for (const item of items) {
    if (!item.review) pending += 1;
  }
  return { pending, total: items.length };
}

export async function loadOpsQueueSummary(): Promise<OpsQueueSummary> {
  const [research, story] = await Promise.all([
    loadResearchCaseQueueSummary(),
    loadStoryPacketQueueSummary(),
  ]);
  return {
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
  const items = await tryListAdminResearchCases({ states: ['candidate', 'relevance_review', 'insufficient_evidence'], limit: 200 });
  if (items === null) {
    return { researchCaseSource: 'unavailable' };
  }
  return {
    researchCasePending: items.length,
    researchCaseSource: 'live',
  };
}

async function loadStoryPacketQueueSummary(): Promise<
  Pick<
    OpsQueueSummary,
    'storyPacketsPending' | 'storyPacketsTotal' | 'storyPacketsSource'
  >
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
    firebaseProjectId:
      process.env.FIREBASE_PROJECT_ID ??
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
      'unknown',
    authMode: process.env.ADMIN_AUTH_MODE ?? 'firebase',
    publicSiteOrigin: adminPublicSiteOrigin(),
    productionBreakGlass: process.env.APP_FIREBASE_ALLOW_PRODUCTION === '1',
  };
}
