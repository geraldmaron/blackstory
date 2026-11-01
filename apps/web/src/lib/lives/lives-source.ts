/**
 * Server-side reader for Lives Across the Decades. Reads the area's static snapshot and merges
 * authored world beats. Upgrades each rule's record link to its law or case page when one exists.
 * Canonical immersive surface is `/lives`.
 */
import { cache } from 'react';
import {
  buildLivesAreaBundle,
  isLivesAreaSnapshot,
  livesAreaBySlug,
  livesSpeakerPlaceMismatch,
  livesSnapshotName,
  type LivesAreaBundle,
  type LivesAreaConfig,
  type LivesAreaSnapshot,
  type LivesRuleEntityRef,
  type LivesWorldBeat,
} from '@repo/domain/statistics/lives';
import { resolvePostgresConnectionString } from '../public-data/postgres-client';
import { fetchMaterializedSnapshot } from '../public-data/public-readers';
import { resolveLawCaseHref } from '../search/law-case-href';
import { LIVES_WORLD_BEAT_FIXTURES } from './world-beat-fixtures';

export type LawHrefResolver = (entity: LivesRuleEntityRef) => Promise<string | undefined>;

function worldBeatsForArea(area: LivesAreaConfig): Map<number, LivesWorldBeat[]> {
  const byDecade = new Map<number, LivesWorldBeat[]>();
  for (const beat of LIVES_WORLD_BEAT_FIXTURES) {
    if (beat.areaIds.length > 0 && !beat.areaIds.includes(area.id)) continue;
    const list = byDecade.get(beat.decade) ?? [];
    list.push({
      id: beat.id,
      domain: beat.domain,
      claimType: beat.claimType,
      heading: beat.heading,
      body: beat.body,
      citations: beat.citations,
      appliesTo: beat.lenses,
      unit: beat.unit,
      entities: beat.entityIds.map((id) => ({
        id,
        href: `/entity/${id}`,
        label: id.replace(/^ent_(?:law|case)_/, '').replace(/_/g, ' '),
      })),
      ...(beat.uncertaintyLabel ? { uncertaintyLabel: beat.uncertaintyLabel } : {}),
      ...(beat.gapState ? { gapState: beat.gapState } : {}),
      ...(beat.quote ? { quote: beat.quote } : {}),
      ...(beat.recording ? { recording: beat.recording } : {}),
      ...(beat.archivePointer ? { archivePointer: beat.archivePointer } : {}),
      ...(beat.speaker
        ? {
            speaker: beat.speaker,
            ...(livesSpeakerPlaceMismatch(beat.speaker.place, area)
              ? { speakerPlaceMismatch: true as const }
              : {}),
          }
        : {}),
    });
    byDecade.set(beat.decade, list);
  }
  return byDecade;
}

function mergeWorldBeats(bundle: LivesAreaBundle, area: LivesAreaConfig): LivesAreaBundle {
  const byDecade = worldBeatsForArea(area);
  return {
    ...bundle,
    decades: bundle.decades.map((decade) => ({
      ...decade,
      worldBeats: byDecade.get(decade.decade) ?? [],
    })),
  };
}

/** Every decade with every figure pending, for an area whose snapshot has not been built. */
export function emptyLivesAreaBundle(area: LivesAreaConfig): LivesAreaBundle {
  return mergeWorldBeats(
    buildLivesAreaBundle({
      area,
      jurisdictions: [],
      observations: [],
      coverage: [],
      countNotes: [],
      applicability: [],
      frames: [],
    }),
    area,
  );
}

/** The snapshot's bundle with each rule linked to its law or case page where one exists. */
export async function linkLivesRules(
  snapshot: LivesAreaSnapshot,
  resolve: LawHrefResolver,
): Promise<LivesAreaBundle> {
  const hrefs = new Map<string, string>();
  await Promise.all(
    Object.entries(snapshot.ruleEntities).map(async ([entityId, entity]) => {
      const href = await resolve(entity);
      if (href) hrefs.set(entityId, href);
    }),
  );
  const withRules =
    hrefs.size === 0
      ? snapshot.bundle
      : {
          ...snapshot.bundle,
          decades: snapshot.bundle.decades.map((decade) => ({
            ...decade,
            rulesInForce: decade.rulesInForce.map((rule) => {
              const href = hrefs.get(rule.entityId);
              return href ? { ...rule, href } : rule;
            }),
          })),
        };
  const area = livesAreaBySlug(snapshot.areaSlug);
  return area ? mergeWorldBeats(withRules, area) : withRules;
}

/**
 * Where an area's bundle came from. Only `snapshot` carries counted figures; the others render the
 * same every-figure-pending bundle but mean different things to a reader: nothing published yet
 * versus a store or snapshot that could not be used.
 */
export type LivesAreaSource = 'snapshot' | 'unpublished' | 'unreadable';

export type LivesAreaView = {
  readonly bundle: LivesAreaBundle;
  readonly source: LivesAreaSource;
};

/**
 * The area's bundle with the reason it is or is not counted, or null when the slug is not the
 * national baseline or a modeled region. A failed database query still throws to the route error
 * boundary; this only separates an empty release from an unusable snapshot.
 */
export const loadLivesAreaView = cache(async (slug: string): Promise<LivesAreaView | null> => {
  const area = livesAreaBySlug(slug);
  if (!area) return null;
  if (!resolvePostgresConnectionString()) {
    return { bundle: emptyLivesAreaBundle(area), source: 'unreadable' };
  }
  const snapshot = await fetchMaterializedSnapshot(livesSnapshotName(area.slug));
  if (snapshot === undefined || snapshot === null) {
    return { bundle: emptyLivesAreaBundle(area), source: 'unpublished' };
  }
  if (!isLivesAreaSnapshot(snapshot) || snapshot.areaSlug !== area.slug) {
    return { bundle: emptyLivesAreaBundle(area), source: 'unreadable' };
  }
  return { bundle: await linkLivesRules(snapshot, resolveLawCaseHref), source: 'snapshot' };
});

/** The area's bundle, or null when the slug is not the national baseline or a modeled region. */
export const loadLivesAreaBundle = cache(async (slug: string): Promise<LivesAreaBundle | null> => {
  return (await loadLivesAreaView(slug))?.bundle ?? null;
});
