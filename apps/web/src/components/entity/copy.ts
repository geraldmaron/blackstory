/**
 * Approved missing-information copy for sparse entity-page sections. Defined once here and
 * reused by every section that can legitimately be empty (claims, related records, timeline,
 * status history) so the language stays consistent project-wide, rather than each section
 * improvising its own "empty" wording. Procedural tone: research incompleteness is framed as a
 * state of the record, never as an absence of history.
 */

export type RecordGapKind =
  'claims' | 'related' | 'timeline' | 'statusHistory' | 'context' | 'relevance';

export type RecordGapCopy = {
  readonly title: string;
  readonly body: string;
};

export const RECORD_GAP_COPY: Readonly<Record<RecordGapKind, RecordGapCopy>> = {
  claims: {
    title: 'No accepted claims yet',
    body:
      'No claims have cleared the evidence bar for this record yet. This reflects the current ' +
      'state of research, not an absence of history. Coverage deepens as research continues.',
  },
  related: {
    title: 'No linked records yet',
    body:
      'No related people, places, institutions, or events have been linked through the published ' +
      'history graph yet for this record. Try a topic tag or the map to keep learning.',
  },
  timeline: {
    title: 'No dated history yet',
    body:
      'No dated status changes or relationship timespans have been published for this record yet. ' +
      'This reflects the current state of research, not an absence of history.',
  },
  statusHistory: {
    title: 'No status recorded',
    body:
      'No lifecycle status has been published for this record yet. This reflects the current ' +
      'state of research, not an absence of history.',
  },
  context: {
    title: 'Historical context forthcoming',
    body:
      'Framing prose for this record has not been published yet. Accepted claims below remain ' +
      'the sourced factual layer when available.',
  },
  relevance: {
    title: 'Relevance basis pending',
    body:
      'A substantiated notability basis has not been published for this record yet, so the ' +
      '"why this appears" explanation is withheld rather than asserted (the fail-closed rule). ' +
      'The documented claims and connections below still carry the record.',
  },
};

/**
 * Record-level state, not a section gap: the record was published from a registry listing and
 * has not been through an evidence sweep yet. Distinct from RECORD_GAP_COPY because it describes
 * how the whole record was built rather than which section is empty — a reader needs to be able
 * to tell "this is all the recorded history" apart from "we have not done the research yet",
 * and silence reads as the former.
 */
export const THIN_RECORD_COPY: RecordGapCopy = {
  title: 'Registry listing',
  body:
    'This record comes from a registry listing and has not been through a full source sweep ' +
    'yet, so what you see here is the listing itself rather than a researched history. ' +
    'This reflects the current state of research, not an absence of history.',
};
