/**
 * Approved missing-information notice for sparse entity sections — mirrors web
 * `RecordGapNotice` with centralized copy from `copy.ts`.
 */
import { EmptyState } from '@/ui';
import { RECORD_GAP_COPY, type RecordGapKind } from './copy';

export type RecordGapNoticeProps = {
  readonly kind: RecordGapKind;
};

export function RecordGapNotice({ kind }: RecordGapNoticeProps) {
  const copy = RECORD_GAP_COPY[kind];
  return <EmptyState title={copy.title} description={copy.body} />;
}
