/**
 * Server-side reader for Lives Across the Decades. Reads the area's static snapshot, built by
 * packages/ops-data/scripts/build-lives-snapshots.ts, and upgrades each rule's record link to its law
 * or case page when one exists. No reference-table queries run at request time. The public surface
 * is `/apparatus?s=lives`; `/lives/[area]` 308s there.
 *
 * Reads skip the release-scoped snapshot cache on purpose: the page is ISR, so reads are already rare,
 * and a rebuilt snapshot should appear at the next revalidation rather than the next release. Without
 * a snapshot the page still renders, with every figure marked not yet counted.
 */
import { cache } from 'react';
import {
  buildLivesAreaBundle,
  isLivesAreaSnapshot,
  livesAreaBySlug,
  livesSnapshotName,
  type LivesAreaBundle,
  type LivesAreaConfig,
  type LivesAreaSnapshot,
  type LivesRuleEntityRef,
} from '@repo/domain/statistics/lives';
import { resolvePostgresConnectionString } from '../public-data/postgres-client';
import { fetchMaterializedSnapshot } from '../public-data/public-readers';
import { resolveLawCaseHref } from '../search/law-case-href';

export type LawHrefResolver = (entity: LivesRuleEntityRef) => Promise<string | undefined>;

/** Every decade with every figure pending, for an area whose snapshot has not been built. */
export function emptyLivesAreaBundle(area: LivesAreaConfig): LivesAreaBundle {
  return buildLivesAreaBundle({
    area,
    jurisdictions: [],
    observations: [],
    coverage: [],
    countNotes: [],
    applicability: [],
    frames: [],
  });
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
  if (hrefs.size === 0) return snapshot.bundle;
  return {
    ...snapshot.bundle,
    decades: snapshot.bundle.decades.map((decade) => ({
      ...decade,
      rulesInForce: decade.rulesInForce.map((rule) => {
        const href = hrefs.get(rule.entityId);
        return href ? { ...rule, href } : rule;
      }),
    })),
  };
}

/** The area's bundle, or null when the slug is not the national baseline or a modeled region. */
export const loadLivesAreaBundle = cache(async (slug: string): Promise<LivesAreaBundle | null> => {
  const area = livesAreaBySlug(slug);
  if (!area) return null;
  if (!resolvePostgresConnectionString()) return emptyLivesAreaBundle(area);
  const snapshot = await fetchMaterializedSnapshot(livesSnapshotName(area.slug));
  if (!isLivesAreaSnapshot(snapshot) || snapshot.areaSlug !== area.slug) {
    return emptyLivesAreaBundle(area);
  }
  return linkLivesRules(snapshot, resolveLawCaseHref);
});
