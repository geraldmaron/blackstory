/**
 * Picks the record chapter 2 opens.
 *
 * The pin is drawn from the release, never hard-coded in prose. A story that shows the same pin
 * every time teaches the reader that the archive is an anecdote. Drawing a different record on
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
 *
 * So is a record whose own line argues against it: an era a decade or more away from the first year
 * its summary names (the walk prints both, one above the other), or a summary that only restates
 * the name and the kind ("Building at 500 Main is a building in ..."), which tells a first-time
 * reader nothing.
 */
import { isViolenceAdjacent } from '../map-experience/camera-dignity';
import type { ExploreMapFeature } from '../map-experience/build-explore-map-source';
import { recordMarkFor } from '../map-experience/geo-precision';
import { placeLabelFor } from '../map-experience/place-label';

export type StoryRecordSpotlight = {
  readonly entityId: string;
  readonly name: string;
  readonly place: string;
  readonly era: string;
  readonly summary: string;
  readonly evidenceCount: number;
  /** Distinct sources behind those claims; 0 when unknown. */
  readonly sourceCount: number;
  readonly kindLabel: string;
  /** Stored public precision: how close the camera may push and which mark the callout draws. */
  readonly precision: string;
};

/** Records with fewer sources than this are not the ones to make the evidence argument with. */
const MIN_EVIDENCE = 1;

/** How far the stored era may sit from the first year the summary names, in years. */
const ERA_SUMMARY_TOLERANCE_YEARS = 10;

/** False when the era decade and the first four-digit year in the summary disagree. */
export function eraAgreesWithSummary(era: string | undefined, summary: string): boolean {
  const decade = era ? /^(\d{4})s$/.exec(era.trim()) : null;
  const year = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(summary);
  if (!decade || !year) return true;
  const start = Number(decade[1]);
  const named = Number(year[1]);
  return (
    named >= start - ERA_SUMMARY_TOLERANCE_YEARS && named <= start + 9 + ERA_SUMMARY_TOLERANCE_YEARS
  );
}

/** True when the summary opens by restating the record's own name ("<name> is a ..."). */
export function summaryRestatesName(name: string, summary: string): boolean {
  const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalize(summary).startsWith(`${normalize(name)} is a`);
}

export function eligibleStoryRecords(
  features: readonly ExploreMapFeature[],
): readonly ExploreMapFeature[] {
  return features.filter((feature) => {
    const properties = feature.properties;
    if (!properties.locationLabel) return false;
    if (properties.evidenceCount < MIN_EVIDENCE) return false;
    if (!properties.oneLineStory) return false;
    if (!eraAgreesWithSummary(properties.eraBuckets[0], properties.oneLineStory)) return false;
    if (summaryRestatesName(properties.displayName, properties.oneLineStory)) return false;
    // The story points at the record on the map; a county or state record draws no point to point at.
    if (recordMarkFor(properties.precision) === 'none') return false;
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
    place: placeLabelFor(feature),
    era: properties.eraBuckets[0] ?? 'Undated',
    summary: properties.oneLineStory,
    evidenceCount: properties.evidenceCount,
    sourceCount: properties.sourceCount ?? 0,
    kindLabel: properties.kindFamily,
    precision: properties.precision,
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
