/**
 * User-facing copy for native Memorial. Dignity-first; incomplete by design. No em dashes.
 */
export const MEMORIAL_INTRO = {
  kicker: 'Remembrance',
  title: 'Memorial',
  lede:
    'Names held in remembrance. Incomplete by design. The list below is the readable record; it does not claim to be a complete roll call.',
} as const;

export const MEMORIAL_BODY = [
  'This memorial is not a complete roll call, and it does not pretend to be. It holds names so they are harder to lose in the scroll of news cycles and map pins.',
  'When a name links to a published place record, you can open it or view the location in Maps at the stored public precision.',
] as const;

export const MEMORIAL_LIST = {
  title: 'Full list',
  lede: 'Alphabetical. Search by name. Linked rows open a published record when one exists.',
  searchPlaceholder: 'Search names…',
  emptyTitle: 'No names matched',
  emptyBody: 'Try a broader spelling or clear the search.',
  note:
    'This list is curated and incomplete. If a name belongs here and is missing, use Submit to send evidence for review.',
  seedNote: 'On-device memorial roll. Entity and map links appear where milestones are published.',
} as const;

export const MEMORIAL_ACTIONS = {
  openRecord: 'Open place record',
  openMaps: 'Open in Maps',
  methodology: 'Methodology',
  submit: 'Submit a lead',
} as const;
