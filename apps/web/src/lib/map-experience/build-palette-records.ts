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
 */
import { getTopicLabel } from '@repo/domain/taxonomy/topics';
import { kindLabelForMark } from '../../components/entity/record-mark';
import type { PaletteRecord } from '../../components/patterns/command-palette/CommandPalette';
import type { ExploreMapFeature } from './build-explore-map-source';
import { placeLabelFor } from './place-label';

/** `topicIds` is the controlled field; `topicTags` is the legacy one still carried by older
 * features. Same precedence the map facet builder uses, so the palette and the Theme facet agree
 * about what a record is about. */
function topicLabelsFor(feature: ExploreMapFeature): readonly string[] {
  const ids = feature.properties.topicIds ?? feature.properties.topicTags;
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
    const topics = topicLabelsFor(feature);
    const kindLabel = kindLabelForMark(feature.properties.kind);
    const eraLabel = feature.properties.eraBuckets[0];
    const summary = feature.properties.oneLineStory;

    return {
      id: feature.properties.entityId,
      name: feature.properties.displayName,
      place: placeLabelFor(feature),
      ...(topics.length > 0 ? { topics } : {}),
      ...(kindLabel !== undefined ? { kindLabel } : {}),
      ...(eraLabel !== undefined ? { eraLabel } : {}),
      ...(summary ? { summary } : {}),
    };
  });
}
