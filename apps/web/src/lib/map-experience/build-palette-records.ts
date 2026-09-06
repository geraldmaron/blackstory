/**
 * The palette's client record index.
 *
 * Separate from `AtlasExperience` so the index has a test that runs over real release features
 * rather than only over what a component test can mount. The palette ranks whatever this returns;
 * a subject the index does not carry is a subject the palette cannot find, so what belongs in a
 * `PaletteRecord` is the whole question and it deserves to be answerable in isolation.
 *
 * Four fields beyond name and place, added in repo-92n2.35: topic labels, kind label, era label,
 * summary. Topic labels resolve through the controlled taxonomy rather than shipping the slug,
 * because a reader types "restrictive covenant" and the id reads `restrictive-covenants`.
 *
 * `buildUnmappedPaletteRecords` (repo-jnmwu) is the second half of that same corpus. A map
 * feature only exists for an entity `exploreMapSourceFor` could place — it drops anything with
 * no resolvable `geoAnchor` (most laws, cases, and national organizations), so a palette built
 * from `view.allFeatures` alone answered a query differently on `/explore` than `/search/api`
 * answered it everywhere else. `evaluateNotabilityGate` is the exact gate the search index
 * build applies (`buildPublicSearchIndexDocs`), called directly on the same
 * `notabilityBasis` field, so this stays the same corpus rather than a second guess at it.
 */
import { evaluateNotabilityGate } from '@repo/domain/relevance/notability-gate';
import { getTopicLabel } from '@repo/domain/taxonomy/topics';
import type { PublicEntityView } from '../../data/public-seed';
import { kindLabelForMark } from '../../components/entity/record-mark';
import type { PaletteRecord } from '../../components/patterns/command-palette/CommandPalette';
import type { ExploreMapFeature } from './build-explore-map-source';
import { placeLabelFor } from './place-label';

/** `topicIds` is the controlled field; `topicTags` is the legacy one still carried by older
 * features. Same precedence the map facet builder uses, so the palette and the Theme facet agree
 * about what a record is about. */
function topicLabels(ids: readonly string[]): readonly string[] {
  const labels: string[] = [];
  for (const id of ids) {
    // An id outside the taxonomy still indexes, on the humanized slug: a record is better found
    // by an unrecognized subject than not found at all.
    const label = getTopicLabel(id) ?? id.replace(/[_-]+/g, ' ');
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function buildPaletteRecords(
  features: readonly ExploreMapFeature[],
): readonly PaletteRecord[] {
  return features.map((feature) => {
    const topics = topicLabels(feature.properties.topicIds ?? feature.properties.topicTags);
    const kindLabel = kindLabelForMark(feature.properties.kind);
    const eraLabel = feature.properties.eraBuckets[0];
    const summary = feature.properties.oneLineStory;

    return {
      id: feature.properties.entityId,
      name: feature.properties.displayName,
      place: placeLabelFor(feature),
      kind: feature.properties.kind,
      ...(topics.length > 0 ? { topics } : {}),
      ...(kindLabel !== undefined ? { kindLabel } : {}),
      ...(eraLabel !== undefined ? { eraLabel } : {}),
      ...(summary ? { summary } : {}),
    };
  });
}

/**
 * The palette records `buildPaletteRecords` cannot produce: search-indexable entities with no
 * map feature in `mappedEntityIds`. `place` falls back to `jurisdictionLabel` — every entity
 * carries one (a law's is its enacting jurisdiction, "Alabama" or "United States") independent
 * of whether it resolved to a map pin, which is exactly the distinction that makes this corpus
 * findable at all without one.
 *
 * `kind` rides along unlabeled so `AtlasExperience`'s `onOpenRecord` fallback — already written
 * to open a record that has no feature via `atlasWalkHref` — can route a law or case to `/law`
 * and a person to `/memorial` instead of guessing at a place page that was never going to hold.
 */
export function buildUnmappedPaletteRecords(
  entities: readonly PublicEntityView[],
  mappedEntityIds: ReadonlySet<string>,
): readonly PaletteRecord[] {
  const records: PaletteRecord[] = [];
  for (const entity of entities) {
    if (mappedEntityIds.has(entity.id)) continue;
    if (!evaluateNotabilityGate(entity.notabilityBasis).passed) continue;

    const topics = topicLabels(entity.topicIds ?? entity.topicTags);
    const kindLabel = kindLabelForMark(entity.kind);
    const eraLabel = entity.eraBuckets?.[0];

    records.push({
      id: entity.id,
      name: entity.displayName,
      place: entity.jurisdictionLabel,
      kind: entity.kind,
      ...(topics.length > 0 ? { topics } : {}),
      ...(kindLabel !== undefined ? { kindLabel } : {}),
      ...(eraLabel !== undefined ? { eraLabel } : {}),
      ...(entity.summary ? { summary: entity.summary } : {}),
    });
  }
  return records;
}
