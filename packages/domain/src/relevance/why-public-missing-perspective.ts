/**
 * BB-054 missing-perspective indicators (BB-054 Deliver #5). Surfaces an honest "our accepted
 * evidence hasn't documented X yet" note for a harm-heavy record — mirroring the RecordGapNotice /
 * BB-052 acceptance criterion 2 convention (research incompleteness is a state of the record, not
 * an absence of history) but applied to the dimension-balance question BB-054 acceptance
 * criterion 3 raises, rather than to an empty section. This module never claims a dimension is
 * ABSENT from the entity's actual history — only that accepted evidence has not documented it yet.
 */
import { STORY_DIMENSIONS, STORY_DIMENSION_LABELS, type StoryDimension } from './why-public-dimensions.js';

const BALANCING_DIMENSIONS: readonly StoryDimension[] = STORY_DIMENSIONS.filter(
  (dimension) => dimension !== 'harm',
);

/** An entity counts as "sufficiently balanced" once accepted evidence documents at least this
 * many non-harm dimensions alongside harm — below that, the gap is named rather than hidden. */
const BALANCED_COVERAGE_MINIMUM = 2;

export type MissingPerspectiveIndicator = {
  readonly dimension: StoryDimension;
  readonly label: string;
  readonly note: string;
};

/**
 * Returns one indicator per non-harm dimension not yet documented, but ONLY when `harm` is
 * present and fewer than `BALANCED_COVERAGE_MINIMUM` other dimensions have cleared the evidence
 * bar. Returns `[]` when `harm` is absent (nothing to balance) or coverage is already sufficiently
 * balanced. Callers typically render only the first few entries — the full list is returned so
 * presentation can decide truncation without re-deriving the underlying gap set.
 */
export function deriveMissingPerspectiveIndicators(
  present: readonly StoryDimension[],
): readonly MissingPerspectiveIndicator[] {
  if (!present.includes('harm')) return [];
  const presentBalancing = present.filter((dimension) => dimension !== 'harm');
  if (presentBalancing.length >= BALANCED_COVERAGE_MINIMUM) return [];

  return BALANCING_DIMENSIONS.filter((dimension) => !present.includes(dimension)).map(
    (dimension) => ({
      dimension,
      label: STORY_DIMENSION_LABELS[dimension],
      note:
        `No documented ${STORY_DIMENSION_LABELS[dimension].toLowerCase()} connection has cleared ` +
        'the evidence bar for this record yet. This reflects the current state of research, not an ' +
        'absence of history.',
    }),
  );
}
