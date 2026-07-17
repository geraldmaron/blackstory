/**
 * Approved missing-information copy for sparse entity-page sections (BB-052 acceptance criterion
 * 2). Defined once here and reused by every section that can legitimately be empty (claims,
 * related records, timeline, status history) so the language stays consistent project-wide,
 * rather than each section improvising its own "empty" wording. Procedural tone: research
 * incompleteness is framed as a state of the record, never as an absence of history.
 */

export type RecordGapKind = 'claims' | 'related' | 'timeline' | 'statusHistory';

export type RecordGapCopy = {
  readonly title: string;
  readonly body: string;
};

export const RECORD_GAP_COPY: Readonly<Record<RecordGapKind, RecordGapCopy>> = {
  claims: {
    title: 'No accepted claims yet',
    body:
      'No claims have cleared the evidence bar for this record yet. This reflects the current ' +
      'state of research, not an absence of history — coverage deepens as research continues.',
  },
  related: {
    title: 'No linked records yet',
    body:
      'No related people, places, institutions, or events have been linked through the published ' +
      'history graph yet for this record.',
  },
  timeline: {
    title: 'No dated history yet',
    body:
      'No dated timeline entries are available yet for this record\u2019s published history graph ' +
      'and status history.',
  },
  statusHistory: {
    title: 'No status history recorded',
    body: 'No time-scoped status designation has been entered for this record yet.',
  },
};
