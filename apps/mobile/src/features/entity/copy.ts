/**
 * Approved copy for the entity detail screen (MOB-014).
 *
 * Mirrored/adapted from web's approved section copy so the two clients read as one product:
 *   - `RECORD_GAP_COPY` mirrors `apps/web/src/components/entity/copy.ts`'s
 *     `RECORD_GAP_COPY` verbatim (procedural tone: a sparse section is a state of the
 *     record's research, never framed as an absence of history).
 *   - Section headings mirror `apps/web/src/app/entity/[id]/page.tsx`'s h2 titles
 *     ("Why this appears", "Historical context", "Further reading", "Status and history" /
 *     "When this happened", "Accepted claims", "Timeline", "Connected records" / "Also
 *     connected").
 *   - The event-window note mirrors `EntityStatusPanel`'s exact sentence.
 *
 * `NOT_PUBLIC_COPY` and `OFFLINE_*` copy are new to mobile (web has no equivalent — it just
 * calls Next's `notFound()`), written to match RECORD_GAP_COPY's dignified, non-alarmist
 * register. See EntityDetailScreen.tsx's header comment for why "withdrawn" and "never
 * existed" share ONE copy block (threat-model T3: the server returns an identical 404 for
 * both, by design, so the client must never imply it knows which).
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
    body: 'This record isn’t linked to other people, places, institutions or events yet.',
  },
  timeline: {
    title: 'No dated history yet',
    body:
      'No dated entries have been published for this record yet. ' +
      'The research hasn’t gotten that far.',
  },
  statusHistory: {
    title: 'No status history recorded',
    body: 'No status with dates has been entered for this record yet.',
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
      '"why this appears" note is left off until it can be backed up. The documented claims ' +
      'and connections below still carry the record.',
  },
};

export const SECTION_HEADINGS = {
  relevance: 'Why this appears',
  context: 'Historical context',
  furtherReading: 'Further reading',
  statusEvent: 'When this happened',
  statusRecord: 'Status and history',
  claims: 'Accepted claims',
  timeline: 'Timeline',
  related: 'Connected records',
  continueLearning: 'Also connected',
  citedIn: 'Stories that cite this record',
  visit: 'Visit',
  revision: 'Revision',
  maturity: 'Research so far',
  media: 'Primary image',
} as const;

export const EVENT_WINDOW_NOTE =
  'An event doesn’t have an active or historic status. It has the dates it happened.';

/** Shared 404 copy — deliberately identical whether the id never existed or was withdrawn
 * (threat-model T3: the server's `/v1/entity/:id` returns one indistinguishable NOT_FOUND for
 * both cases, so the client must not imply it knows which). Dignified, not alarming. */
export const NOT_PUBLIC_COPY = {
  title: 'This record isn’t public right now',
  body:
    'This entry isn’t in the current published edition. It may have been withdrawn, it may be ' +
    'under review, or the link may be out of date. Other BlackStory records aren’t affected.',
  action: 'Back to Explore',
};

export const GENERIC_ERROR_COPY = {
  title: 'Couldn’t load this record',
  description: 'Check your connection and try again.',
  retry: 'Try again',
};

export const OFFLINE_NO_CACHE_COPY = {
  title: 'You’re offline',
  description:
    'This record hasn’t been viewed on this device before, so it can’t be shown offline.',
  retry: 'Try again',
};

export const OFFLINE_CITATION_COPY = {
  title: 'You’re offline',
  description: 'Connect to the internet to open this source link.',
};

export const UNSAFE_LINK_COPY = {
  title: 'This link can’t be opened',
  description: 'The source link for this citation isn’t a valid web address.',
};

export function cachedBannerTitle(): string {
  return 'Showing a saved copy';
}
