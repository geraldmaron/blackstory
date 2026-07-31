/**
 * Picks the record chapter 2 opens.
 *
 * The chapter used to be the A.G. Gaston Motel, hard-coded in prose. A story that shows the same
 * pin every time teaches the reader that the archive is an anecdote. Drawing a different record on
 * each visit is the chapter's actual argument — *every* pin opens into evidence, not one famous
 * one — and it means the copy has to come from the record rather than from a writer.
 *
 * Two records are excluded on purpose.
 *
 * A violence-adjacent record never appears here. The chapter's whole move is to push in close on a
 * pin and dwell there, and `camera-dignity.ts` exists because dwelling on harm for effect is the
 * failure mode this archive refuses. The camera gate would already refuse the drama; excluding the
 * record refuses the framing as well, which the gate cannot do on its own.
 *
 * A record with no published location prose is excluded because the chapter names a place. Falling
 * back to "Place not published" would put the weakest record in the release in front of a reader
 * being told the archive is worth trusting.
 */
import { isViolenceAdjacent } from '../map-experience/camera-dignity';
import type { ExploreMapFeature } from '../map-experience/build-explore-map-source';

export type StoryRecordSpotlight = {
  readonly entityId: string;
  readonly name: string;
  readonly place: string;
  readonly era: string;
  readonly summary: string;
  readonly evidenceCount: number;
  readonly kindLabel: string;
};

/** Records with fewer sources than this are not the ones to make the evidence argument with. */
const MIN_EVIDENCE = 1;

export function eligibleStoryRecords(
  features: readonly ExploreMapFeature[],
): readonly ExploreMapFeature[] {
  return features.filter((feature) => {
    const properties = feature.properties;
    if (!properties.locationLabel) return false;
    if (properties.evidenceCount < MIN_EVIDENCE) return false;
    if (!properties.oneLineStory) return false;
    return !isViolenceAdjacent({
      ...(properties.kind !== undefined ? { kind: properties.kind } : {}),
      ...(properties.mapTone !== undefined ? { mapTone: properties.mapTone } : {}),
      topicTags: properties.topicTags,
      ...(properties.topicIds !== undefined ? { topicIds: properties.topicIds } : {}),
      displayName: properties.displayName,
    });
  });
}

export function toStoryRecordSpotlight(feature: ExploreMapFeature): StoryRecordSpotlight {
  const properties = feature.properties;
  return {
    entityId: properties.entityId,
    name: properties.displayName,
    place: properties.locationLabel ?? properties.stateName ?? 'Place not published',
    era: properties.eraBuckets[0] ?? 'Undated',
    summary: properties.oneLineStory,
    evidenceCount: properties.evidenceCount,
    kindLabel: properties.kindFamily,
  };
}

/**
 * `roll` is any number in [0, 1). Taken as an argument rather than read from `Math.random()` here
 * so the choice is reproducible in a test and so the caller decides when the die is thrown — once
 * per visit to the story, not once per render.
 */
export function pickStoryRecord(
  features: readonly ExploreMapFeature[],
  roll: number,
): StoryRecordSpotlight | null {
  const eligible = eligibleStoryRecords(features);
  if (eligible.length === 0) return null;
  const bounded = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999) : 0;
  const feature = eligible[Math.floor(bounded * eligible.length)];
  return feature ? toStoryRecordSpotlight(feature) : null;
}
