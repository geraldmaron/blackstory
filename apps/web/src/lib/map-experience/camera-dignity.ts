/**
 * Dignity gate on camera motion (design-direction-v9-atlas.md §4.3).
 *
 * Camera drama is permitted for geography and scale. It is not permitted to dramatise harm. This
 * module makes that an enforced gate rather than a review convention, because a convention only
 * holds until someone adds a call site in a hurry.
 *
 * The vocabulary is the catalog's own. Tone comes from `resolveMapTone` in `kind-encoding.ts`,
 * reused rather than reimplemented, so a record cannot read as `massacre` for painting and as
 * something else for camera purposes. The one thing tone does not carry is lynching: the
 * `MapSemanticTone` union is massacre / plantation / epicenter, and §4.3 names lynching
 * explicitly, so lynching and its neighbors are matched from topic slugs using the same
 * substring technique `mapToneFromTopics` already uses on the same fields.
 */

import { resolveMapTone } from './kind-encoding';
import type { CameraMove } from './camera-moves';

export type RecordLike = {
  readonly kind?: string | undefined;
  /** Precomputed `MapSemanticTone` when the caller already has it. */
  readonly mapTone?: string | undefined;
  readonly topicTags?: readonly string[] | undefined;
  readonly topicIds?: readonly string[] | undefined;
  readonly displayName?: string | undefined;
};

/**
 * Tones that mark a record as violence-adjacent.
 *
 * `massacre` is named directly by §4.3. `plantation` is included as a site of enslavement: the
 * rule bans dramatising harm, and an orbit "for gravitas" over a plantation is precisely the
 * failure mode it exists to prevent. `epicenter` is deliberately absent — it encodes presence,
 * and presence is what the camera is for.
 */
const VIOLENCE_ADJACENT_TONES: ReadonlySet<string> = new Set(['massacre', 'plantation']);

/**
 * Topic substrings that mark violence the tone union does not carry.
 *
 * Substring matching mirrors `mapToneFromTopics`, which reads the same `topicTags` / `topicIds`
 * fields. It is deliberately broad: over-matching costs a record some camera drama, under-matching
 * puts a push-in on a lynching. The asymmetry is the whole point.
 */
const VIOLENCE_ADJACENT_TOPIC_TERMS: readonly string[] = [
  'lynch',
  'massacre',
  'pogrom',
  'atrocity',
  'riot',
  'sundown',
  'destruction',
  'displacement',
  'racial-violence',
  'racial_violence',
  'racial violence',
  'terror',
];

/** Moves permitted on a violence-adjacent record: plain arrival and framing, no drama. */
const DIGNIFIED_MOVES: readonly CameraMove[] = ['wide', 'flyToRecord', 'tilt'];

export const ALL_CAMERA_MOVES: readonly CameraMove[] = [
  'wide',
  'push',
  'orbit',
  'tilt',
  'spotlight',
  'trace',
  'flyToRecord',
];

function toneFor(record: RecordLike): string | undefined {
  if (record.mapTone) return record.mapTone;
  return resolveMapTone({
    ...(record.topicTags !== undefined ? { topicTags: record.topicTags } : {}),
    ...(record.topicIds !== undefined ? { topicIds: record.topicIds } : {}),
    ...(record.displayName !== undefined ? { displayName: record.displayName } : {}),
  });
}

export function isViolenceAdjacent(record: RecordLike): boolean {
  const tone = toneFor(record);
  if (tone && VIOLENCE_ADJACENT_TONES.has(tone)) return true;

  const haystack = [...(record.topicTags ?? []), ...(record.topicIds ?? [])]
    .join(' | ')
    .toLowerCase();
  if (!haystack) return false;
  return VIOLENCE_ADJACENT_TOPIC_TERMS.some((term) => haystack.includes(term));
}

/**
 * The moves this record permits.
 *
 * Two rules compose:
 *   1. a violence-adjacent record permits only `wide`, `flyToRecord` and `tilt`
 *   2. `spotlight` is refused for any person record regardless of tone, because the spotlight
 *      isolates, and isolating an individual human being is not something this archive does
 */
export function allowedMovesFor(record: RecordLike): ReadonlySet<CameraMove> {
  const allowed = new Set<CameraMove>(
    isViolenceAdjacent(record) ? DIGNIFIED_MOVES : ALL_CAMERA_MOVES,
  );
  if (record.kind === 'person') allowed.delete('spotlight');
  return allowed;
}

export function isMoveAllowed(move: CameraMove, record: RecordLike | null | undefined): boolean {
  // No selected record means the move is about geography, not about a person or an event.
  if (!record) return true;
  return allowedMovesFor(record).has(move);
}
