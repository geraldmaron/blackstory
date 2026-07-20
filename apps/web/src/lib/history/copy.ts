/**
 * Approved copy for the `/history` browse surface sparse-decade gaps, dignity framing,
 * and degraded-mode messaging. Centralized here so the page, list peer, and graph panel never
 * improvise inconsistent "empty history" language.
 */

export type HistoryGapKind = 'sparseDecade' | 'noConnections' | 'noFilterMatch';

export type HistoryGapCopy = {
  readonly title: string;
  readonly body: string;
};

export const HISTORY_GAP_COPY: Readonly<Record<HistoryGapKind, HistoryGapCopy>> = {
  sparseDecade: {
    title: 'Limited published coverage for this decade',
    body:
      'The active release does not yet include enough dated, accepted records to populate a ' +
      'decade view here. That reflects the current state of research and publication — not an ' +
      'absence of history in this period. Browse another decade or the all-time view to see ' +
      'what is published today.',
  },
  noConnections: {
    title: 'No documented connections in this view',
    body:
      'No evidence-backed relationships between the records in this view have cleared the ' +
      'publication bar yet. Connections appear only when both endpoints and supporting citations ' +
      'are published.',
  },
  noFilterMatch: {
    title: 'No records match these filters',
    body:
      'Try clearing filters or choosing a different decade. The synchronized list always reflects ' +
      'the same filtered set as the data panel.',
  },
};

export const HISTORY_DIGNITY_FRAMING =
  'Presence and affirmation records appear alongside harm and policy records with equal visual weight — ' +
  'this browse surface never uses violence heat styling or crime-density rendering.';

export const HISTORY_DECADE_FRAMING =
  'Decade views show status as-of that decade from published status history — never present-day status backfilled.';
