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
      'Nothing on this record has cleared the evidence bar yet. That’s where the research ' +
      'stands, and it doesn’t mean there’s no history here.',
  },
  related: {
    title: 'No linked records yet',
    body:
      'This record isn’t linked to other people, places, institutions or events yet. ' +
      'Try a topic tag or the map to keep going.',
  },
  timeline: {
    title: 'No dated history yet',
    body:
      'No dated changes have been published for this record yet. ' +
      'The research hasn’t gotten that far.',
  },
  statusHistory: {
    title: 'No status recorded',
    body:
      'No status has been published for this record yet. ' + 'The research hasn’t gotten that far.',
  },
  context: {
    title: 'Background still to come',
    body:
      'The background for this record hasn’t been written yet. ' +
      'Any accepted claims below are still sourced.',
  },
  relevance: {
    title: 'Why it’s here, still to come',
    body:
      'The sourced reason this record belongs here hasn’t been published yet, so the ' +
      '"why this appears" note is left off until it can be backed up. ' +
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
    'This record comes from a registry listing and hasn’t had a full source search yet, ' +
    'so what you see here is the listing itself and not a researched history. ' +
    'That’s where the research stands, and it doesn’t mean there’s no history here.',
};

/**
 * Record-level state, not a section gap: the record has been researched — it has real narrative
 * context — but every fact on it still traces back to one source document. Distinct from
 * THIN_RECORD_COPY, which covers a record that has not been researched at all; this record has,
 * it just has not been checked against a second source yet.
 */
export const SINGLE_SOURCE_COPY: RecordGapCopy = {
  title: 'Single source',
  body:
    'Every fact on this record traces back to one source document, and it hasn’t been ' +
    'checked against a second, independent source yet.',
};
