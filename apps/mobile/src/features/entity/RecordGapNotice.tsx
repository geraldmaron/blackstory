/**
 * Approved missing-information notice for sparse entity sections — mirrors web
 * `RecordGapNotice` with centralized copy from `copy.ts`.
 *
 * Rendered as a single compact `Notice` (one bodySmall line), NOT a full `EmptyState`: a sparse
 * record can be missing up to five sections at once, and five 48pt glyphs with 32pt padding down
 * the spine reads as a wall of alarm. `EmptyState` is reserved for whole-screen emptiness.
 */
import { Notice } from '@/ui';
import { RECORD_GAP_COPY, type RecordGapKind } from './copy';

export type RecordGapNoticeProps = {
  readonly kind: RecordGapKind;
};

export function RecordGapNotice({ kind }: RecordGapNoticeProps) {
  const copy = RECORD_GAP_COPY[kind];
  return <Notice tone="info" compact title={copy.title} description={copy.body} />;
}
