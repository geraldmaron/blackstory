/**
 * Theme-impact read routing: active-release Postgres packets only. There is no
 * checked-in content fallback; when the release read path is unavailable the
 * caller receives an explicit `unavailable` source and renders a friendly
 * degraded state instead of stale substitute content.
 */
import {
  THEME_IMPACT_THEME_IDS,
  themeImpactPacketToView,
  type ThemeImpactPacket,
  type ThemeImpactPacketView,
} from '@repo/domain';
import { cache } from 'react';
import type {
  PublicStoryProjectionDoc,
  PublicStorySectionDisputeDoc,
  PublicStorySectionMomentDoc,
} from '@repo/schemas';
import type { PublicEntityView } from '../../data/public-seed';
import { hasPostgresConnection } from '../public-data/live-policy';
import { listPublicEntityViewsByIds, listPublicStoryViews } from '../public-data/source';
import { getThemeCatalogEntry, listCatalogThemeIds } from './catalog';
import {
  fetchReleaseThemeImpactPacket,
  listReleaseThemeImpactPacketsByTheme,
  listReleaseThemeImpactThemeIds,
} from './postgres-readers';

export type ThemeImpactReadSource = 'live' | 'unavailable';

function liveToView(packet: ThemeImpactPacket): ThemeImpactPacketView {
  return themeImpactPacketToView(packet, { dataSource: 'live' });
}

function shouldAttemptLiveReads(): boolean {
  return hasPostgresConnection();
}

function logReadFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[theme-impact] ${context} failed; rendering unavailable state: ${message}`);
}

const listLivePacketsByTheme = cache(
  async (
    themeId: string,
  ): Promise<{
    readonly packets: readonly ThemeImpactPacket[];
    readonly source: ThemeImpactReadSource;
  }> => {
    if (!shouldAttemptLiveReads()) return { packets: [], source: 'unavailable' };
    try {
      return { packets: await listReleaseThemeImpactPacketsByTheme(themeId), source: 'live' };
    } catch (error) {
      logReadFailure(`listReleaseThemeImpactPacketsByTheme(${themeId})`, error);
      return { packets: [], source: 'unavailable' };
    }
  },
);

/**
 * Theme ids that are available on the public surface: catalog themes whose
 * active release carries at least one packet. `ok: false` means the release
 * read path itself failed, which callers should surface as a temporary outage
 * rather than an empty catalog.
 */
export const resolveAvailableThemeIds = cache(
  async (): Promise<{ readonly ids: readonly string[]; readonly ok: boolean }> => {
    if (!shouldAttemptLiveReads()) return { ids: [], ok: false };
    try {
      const releaseThemeIds = new Set(await listReleaseThemeImpactThemeIds());
      return { ids: listCatalogThemeIds().filter((id) => releaseThemeIds.has(id)), ok: true };
    } catch (error) {
      logReadFailure('listReleaseThemeImpactThemeIds', error);
      return { ids: [], ok: false };
    }
  },
);

export async function isThemeAvailable(themeId: string): Promise<boolean> {
  const { ids } = await resolveAvailableThemeIds();
  return ids.includes(themeId);
}

export async function listThemeImpactPacketViews(
  themeId: string,
): Promise<{ readonly packets: readonly ThemeImpactPacketView[]; readonly source: ThemeImpactReadSource }> {
  const { packets, source } = await listLivePacketsByTheme(themeId);
  return { packets: packets.map(liveToView), source };
}

export async function resolveThemeImpactPacketView(
  themeId: string,
  questionId: string,
): Promise<ThemeImpactPacketView | undefined> {
  if (!shouldAttemptLiveReads()) return undefined;
  try {
    const live = await fetchReleaseThemeImpactPacket(themeId, questionId);
    return live ? liveToView(live) : undefined;
  } catch (error) {
    logReadFailure(`fetchReleaseThemeImpactPacket(${themeId}, ${questionId})`, error);
    return undefined;
  }
}

/** Redlining Q3 pilot packet for story embed / map strip consumers. */
export async function resolveRedliningPilotPacketView(): Promise<
  ThemeImpactPacketView | undefined
> {
  return resolveThemeImpactPacketView('redlining', 'Q3');
}

/* -------------------------------------------------------------------------------------------- *
 * Theme spine: multi-story arcs bound to a theme via `themeBinding`, with body sections
 * hydrated with theme-impact "moments" (observation/artifact/derived refs) and disputes.
 *
 * `themeBinding` on `PublicStoryProjectionDoc` and `moments`/`disputes` on each body section
 * (repo-cqey.2) are the real exported schema types — see packages/schemas/src/public-projections.ts.
 * -------------------------------------------------------------------------------------------- */

export type ThemeSpineMomentRef = PublicStorySectionMomentDoc;
export type ThemeSpineDispute = PublicStorySectionDisputeDoc;

/** A hydrated `observation`/`artifact`/`derived` moment — rendered as a `DataMoment`. */
export type HydratedThemeSpineDataMoment = {
  readonly kind: 'data';
  readonly figure: string;
  readonly claim: string;
  readonly provenance: {
    readonly source: string;
    readonly capture: string;
    readonly confidence: string;
  };
  readonly methodStance: ThemeImpactPacketView['methodStance'];
};

export type ThemeSpineTimelineEvent = {
  readonly label: string;
  readonly date: string;
};

export type ThemeSpinePolicyEra = {
  readonly id: string;
  readonly label: string;
  readonly span?: string;
};

/** A hydrated `timeline` moment — rendered as an `EraTimeline`. */
export type HydratedThemeSpineTimelineMoment = {
  readonly kind: 'timeline';
  readonly events: readonly ThemeSpineTimelineEvent[];
  readonly policyEras: readonly ThemeSpinePolicyEra[];
};

/** A hydrated `map` moment — rendered as a `MapInsetMoment`. `refId` is the entity id. */
export type HydratedThemeSpineMapMoment = {
  readonly kind: 'map';
  readonly entityId: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: 'city' | 'neighborhood' | 'campus' | 'institution';
};

export type HydratedThemeSpineMoment =
  | HydratedThemeSpineDataMoment
  | HydratedThemeSpineTimelineMoment
  | HydratedThemeSpineMapMoment;

export type ThemeSpineSection = {
  readonly heading?: string;
  readonly paragraphs: readonly string[];
  readonly moments: readonly HydratedThemeSpineMoment[];
  readonly disputes: readonly ThemeSpineDispute[];
};

export type ThemeSpineChapter = {
  readonly story: PublicStoryProjectionDoc;
  readonly sections: readonly ThemeSpineSection[];
};

export type ThemeSpine = {
  readonly theme: string;
  readonly chapters: readonly ThemeSpineChapter[];
};

type MomentSourceItem = {
  readonly figure: string;
  readonly claim: string;
  readonly provenance?: ThemeImpactPacketView['observations'][number]['provenance'];
};

function momentSourceItem(
  packet: ThemeImpactPacketView,
  moment: ThemeSpineMomentRef,
): MomentSourceItem | undefined {
  if (moment.kind === 'observation') {
    const row = packet.observations.find((item) => item.id === moment.refId);
    return row ? { figure: row.value, claim: row.label, provenance: row.provenance } : undefined;
  }
  if (moment.kind === 'derived') {
    const row = packet.derived.find((item) => item.id === moment.refId);
    return row ? { figure: row.value, claim: row.label, provenance: row.provenance } : undefined;
  }
  const row = packet.artifacts.find((item) => item.id === moment.refId);
  if (!row) return undefined;
  return row.provenance
    ? { figure: row.title, claim: row.summary, provenance: row.provenance }
    : { figure: row.title, claim: row.summary };
}

function hydrateDataMoment(
  packet: ThemeImpactPacketView,
  moment: ThemeSpineMomentRef,
): HydratedThemeSpineDataMoment | undefined {
  const source = momentSourceItem(packet, moment);
  if (!source) {
    console.warn(
      `[theme-spine] moment references unknown ${moment.kind} refId "${moment.refId}" on packet "${moment.packetId}" — dropping moment`,
    );
    return undefined;
  }

  if (!source.provenance) {
    console.warn(
      `[theme-spine] moment refId "${moment.refId}" on packet "${moment.packetId}" is missing provenance — dropping moment`,
    );
    return undefined;
  }

  const confidence = packet.gapStates.includes('insufficient_evidence')
    ? 'insufficient_evidence'
    : packet.methodStance;

  return {
    kind: 'data',
    figure: source.figure,
    claim: source.claim,
    provenance: {
      source: source.provenance.source,
      capture: source.provenance.retrieved_at,
      confidence,
    },
    methodStance: packet.methodStance,
  };
}

/**
 * A `timeline` moment sources its events from the packet's dated artifacts (the
 * `event_timeline` multi-decade evidence-spine item) and its era band from `policyEras`.
 * `refId` is not used to look up a single row — the whole packet's dated-artifact set is
 * the timeline — but the schema still requires a non-empty `refId` on every moment.
 */
function hydrateTimelineMoment(
  packet: ThemeImpactPacketView,
  moment: ThemeSpineMomentRef,
): HydratedThemeSpineTimelineMoment | undefined {
  const events = packet.artifacts
    .filter((artifact): artifact is typeof artifact & { readonly dateLabel: string } =>
      Boolean(artifact.dateLabel),
    )
    .map((artifact) => ({ label: artifact.title, date: artifact.dateLabel }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) {
    console.warn(
      `[theme-spine] timeline moment on packet "${moment.packetId}" (refId "${moment.refId}") has no dated artifacts — dropping moment`,
    );
    return undefined;
  }

  return { kind: 'timeline', events, policyEras: packet.policyEras };
}

/** A `map` moment's `refId` is the entity id to pin — resolved against `entitiesById`. */
function hydrateMapMoment(
  entitiesById: ReadonlyMap<string, PublicEntityView>,
  moment: ThemeSpineMomentRef,
): HydratedThemeSpineMapMoment | undefined {
  const entity = entitiesById.get(moment.refId);
  if (!entity) {
    console.warn(
      `[theme-spine] map moment references unknown entity refId "${moment.refId}" — dropping moment`,
    );
    return undefined;
  }
  if (!entity.geoAnchor) {
    console.warn(
      `[theme-spine] map moment entity "${moment.refId}" has no geo anchor — dropping moment`,
    );
    return undefined;
  }

  return {
    kind: 'map',
    entityId: entity.id,
    label: entity.displayName,
    lat: entity.geoAnchor.lat,
    lng: entity.geoAnchor.lng,
    precision: entity.locationPrecision,
  };
}

function hydrateMoment(
  packetsByPacketId: ReadonlyMap<string, ThemeImpactPacketView>,
  entitiesById: ReadonlyMap<string, PublicEntityView>,
  moment: ThemeSpineMomentRef,
): HydratedThemeSpineMoment | undefined {
  if (moment.kind === 'map') {
    return hydrateMapMoment(entitiesById, moment);
  }

  const packet = packetsByPacketId.get(moment.packetId);
  if (!packet) {
    console.warn(
      `[theme-spine] moment references unknown packetId "${moment.packetId}" (refId "${moment.refId}") — dropping moment`,
    );
    return undefined;
  }

  if (moment.kind === 'timeline') {
    return hydrateTimelineMoment(packet, moment);
  }

  return hydrateDataMoment(packet, moment);
}

/**
 * Resolve a theme's chapter spine: published stories bound to `themeId` via `themeBinding`,
 * ordered by `chapterIndex`, with each body section's `moments` hydrated against published
 * theme-impact packets for the same theme. A moment whose packet or ref is missing is dropped
 * (logged via `console.warn`) rather than throwing — the chapter still renders without it.
 *
 * Stories are read via the existing `listPublicStoryViews()` story reader only — no new
 * live/Postgres read path is added here. Theme-impact packets keep this module's existing
 * live-with-fixture-fallback behavior via `listThemeImpactPacketViews`.
 *
 * `deps` is test-only dependency injection (defaults to the real readers above); production
 * callers should never pass it.
 */
export async function resolveThemeSpine(
  themeId: string,
  deps?: {
    readonly listStories?: typeof listPublicStoryViews;
    readonly listPackets?: typeof listThemeImpactPacketViews;
    readonly listEntities?: typeof listPublicEntityViewsByIds;
  },
): Promise<ThemeSpine> {
  const listStories = deps?.listStories ?? listPublicStoryViews;
  const listPackets = deps?.listPackets ?? listThemeImpactPacketViews;
  const listEntities = deps?.listEntities ?? listPublicEntityViewsByIds;

  const { data: allStories } = await listStories();
  const boundStories = allStories
    .filter((story) => story.themeBinding?.themeId === themeId)
    .sort((a, b) => (a.themeBinding?.chapterIndex ?? 0) - (b.themeBinding?.chapterIndex ?? 0));

  if (boundStories.length === 0) {
    return { theme: themeId, chapters: [] };
  }

  const { packets } = await listPackets(themeId);
  const packetsByPacketId = new Map(
    packets.filter((packet) => packet.packetId).map((packet) => [packet.packetId as string, packet]),
  );

  const mapEntityIds = new Set<string>();
  for (const story of boundStories) {
    for (const section of story.body) {
      for (const moment of section.moments ?? []) {
        if (moment.kind === 'map') mapEntityIds.add(moment.refId);
      }
    }
  }
  const entitiesById = new Map<string, PublicEntityView>();
  if (mapEntityIds.size > 0) {
    const { data: entities } = await listEntities([...mapEntityIds]);
    for (const entity of entities) entitiesById.set(entity.id, entity);
  }

  const chapters: ThemeSpineChapter[] = boundStories.map((story) => ({
    story,
    sections: story.body.map((section) => ({
      ...(section.heading !== undefined ? { heading: section.heading } : {}),
      paragraphs: section.paragraphs,
      moments: (section.moments ?? [])
        .map((moment) => hydrateMoment(packetsByPacketId, entitiesById, moment))
        .filter((moment): moment is HydratedThemeSpineMoment => moment !== undefined),
      disputes: section.disputes ?? [],
    })),
  }));

  return { theme: themeId, chapters };
}

/* -------------------------------------------------------------------------------------------- *
 * Entity cross-references (repo-cqey.8): resolve every published surface a given entityId
 * appears on — chaptered story chapters (via `relatedEntityIds`), unbound stories, and
 * theme-impact packets bound via `entityBinding.entityId`. Read-only composition over the
 * existing `listPublicStoryViews` / `listThemeImpactPacketViews` readers — no new live reads.
 * -------------------------------------------------------------------------------------------- */

export type EntityCrossReferenceSurface =
  | {
      readonly kind: 'chapter';
      readonly storyId: string;
      readonly storySlug: string;
      readonly storyTitle: string;
      readonly themeId: string;
      readonly themeTitle: string;
      readonly chapterIndex: number;
    }
  | {
      readonly kind: 'story';
      readonly storyId: string;
      readonly storySlug: string;
      readonly storyTitle: string;
    }
  | {
      readonly kind: 'theme_packet';
      readonly themeId: string;
      readonly themeTitle: string;
      readonly questionId: string;
      readonly packetLabel: string;
    };

/**
 * Resolve every surface `entityId` appears on. `deps` is test-only dependency injection
 * (defaults to the real readers); production callers should never pass it.
 */
export async function resolveEntityCrossReferences(
  entityId: string,
  deps?: {
    readonly listStories?: typeof listPublicStoryViews;
    readonly listPackets?: typeof listThemeImpactPacketViews;
    readonly themeIds?: readonly string[];
    readonly getThemeTitle?: (themeId: string) => string | undefined;
  },
): Promise<readonly EntityCrossReferenceSurface[]> {
  const listStories = deps?.listStories ?? listPublicStoryViews;
  const listPackets = deps?.listPackets ?? listThemeImpactPacketViews;
  const themeIds = deps?.themeIds ?? THEME_IMPACT_THEME_IDS;
  const getThemeTitle = deps?.getThemeTitle ?? ((themeId: string) => getThemeCatalogEntry(themeId)?.title);

  const surfaces: EntityCrossReferenceSurface[] = [];

  const { data: stories } = await listStories();
  for (const story of stories) {
    if (!story.relatedEntityIds.includes(entityId)) continue;
    const themeTitle = story.themeBinding ? getThemeTitle(story.themeBinding.themeId) : undefined;
    if (story.themeBinding && themeTitle) {
      surfaces.push({
        kind: 'chapter',
        storyId: story.id,
        storySlug: story.slug,
        storyTitle: story.title,
        themeId: story.themeBinding.themeId,
        themeTitle,
        chapterIndex: story.themeBinding.chapterIndex,
      });
    } else {
      surfaces.push({
        kind: 'story',
        storyId: story.id,
        storySlug: story.slug,
        storyTitle: story.title,
      });
    }
  }

  for (const themeId of themeIds) {
    const themeTitle = getThemeTitle(themeId);
    if (!themeTitle) continue;
    const { packets } = await listPackets(themeId);
    for (const packet of packets) {
      if (packet.entityBinding?.entityId !== entityId) continue;
      surfaces.push({
        kind: 'theme_packet',
        themeId,
        themeTitle,
        questionId: packet.questionId,
        packetLabel: packet.question,
      });
    }
  }

  return surfaces;
}

/** Build an in-app href for a resolved cross-reference surface. Never returns a dead link. */
/**
 * Theme ids with an authored chapter under /chapters. Themes not listed here
 * have no chapter yet (repo-8602) and fall back to the chapters index — the
 * same place the /themes/:path* catch-all redirect would land them, but
 * without the extra 308 hop.
 */
const THEME_CHAPTER_SLUGS: Readonly<Record<string, string>> = {
  redlining: 'buying-a-home',
  wealth_gap: 'the-gap-that-never-closed',
};

function themeHref(themeId: string, fragment?: string): string {
  const slug = THEME_CHAPTER_SLUGS[themeId];
  if (slug === undefined) return '/chapters';
  return fragment === undefined ? `/chapters/${slug}` : `/chapters/${slug}#${fragment}`;
}

export function entityCrossReferenceHref(surface: EntityCrossReferenceSurface): string {
  switch (surface.kind) {
    case 'chapter':
      return themeHref(surface.themeId, `chapter-${surface.chapterIndex}`);
    case 'story':
      return `/stories/${surface.storySlug}`;
    case 'theme_packet':
      return themeHref(surface.themeId);
  }
}

/** Human label for a resolved cross-reference surface, used in exit-rail/appears-in copy. */
export function entityCrossReferenceLabel(surface: EntityCrossReferenceSurface): string {
  switch (surface.kind) {
    case 'chapter':
      return `${surface.themeTitle}: ${surface.storyTitle}`;
    case 'story':
      return surface.storyTitle;
    case 'theme_packet':
      return `${surface.themeTitle}: ${surface.packetLabel}`;
  }
}

/** One "follow `<entity>` into `<other surface>`" exit link for a chapter's close block. */
export type ChapterEntityExit = {
  readonly entityId: string;
  readonly entityLabel: string;
  readonly targetLabel: string;
  readonly href: string;
};

/**
 * Resolve entity exit links for each chapter: for every entity related to a chapter's story,
 * find one OTHER surface (a different chapter, an unbound story, or a theme packet) that entity
 * also appears on. Chapters/entities with no other surface (or no resolvable display name) are
 * omitted entirely — the close block must never render a dead link.
 *
 * `deps` is test-only dependency injection (defaults to the real readers); production callers
 * should never pass it.
 */
export async function resolveChapterEntityExits(
  chapters: readonly ThemeSpineChapter[],
  deps?: {
    readonly resolveCrossReferences?: typeof resolveEntityCrossReferences;
    readonly listEntities?: typeof listPublicEntityViewsByIds;
  },
): Promise<ReadonlyMap<string, readonly ChapterEntityExit[]>> {
  const resolveCrossReferences = deps?.resolveCrossReferences ?? resolveEntityCrossReferences;
  const listEntities = deps?.listEntities ?? listPublicEntityViewsByIds;

  const allEntityIds = new Set<string>();
  for (const chapter of chapters) {
    for (const id of chapter.story.relatedEntityIds) allEntityIds.add(id);
  }
  if (allEntityIds.size === 0) return new Map();

  const { data: entities } = await listEntities([...allEntityIds]);
  const displayNameById = new Map(entities.map((entity) => [entity.id, entity.displayName]));

  const result = new Map<string, readonly ChapterEntityExit[]>();
  for (const chapter of chapters) {
    const exits: ChapterEntityExit[] = [];
    for (const entityId of chapter.story.relatedEntityIds) {
      const entityLabel = displayNameById.get(entityId);
      if (!entityLabel) continue;

      const surfaces = await resolveCrossReferences(entityId);
      const other = surfaces.find(
        (surface) => !(surface.kind === 'chapter' && surface.storyId === chapter.story.id),
      );
      if (!other) continue;

      exits.push({
        entityId,
        entityLabel,
        targetLabel: entityCrossReferenceLabel(other),
        href: entityCrossReferenceHref(other),
      });
    }
    if (exits.length > 0) result.set(chapter.story.id, exits);
  }
  return result;
}
