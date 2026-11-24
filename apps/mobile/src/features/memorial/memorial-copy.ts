/**
 * User-facing copy for native Memorial. Dignity-first; incomplete by design. No em dashes.
 */
export const MEMORIAL_INTRO = {
  kicker: 'Remembrance',
  title: 'Memorial',
  lede: 'Names, held in remembrance. The list below isn’t complete, and it doesn’t claim to be.',
} as const;

export const MEMORIAL_BODY = [
  'This memorial isn’t a complete roll call and doesn’t pretend to be. It holds these names so they’re harder to lose under the next news cycle.',
  'When a name links to a published place record, you can open it or see the location in Maps, no sharper than the record’s public precision.',
] as const;

export const MEMORIAL_LIST = {
  title: 'Full list',
  lede: 'Alphabetical. Search by name. Linked rows open a published record when one exists.',
  searchPlaceholder: 'Search names…',
  emptyTitle: 'No names matched',
  emptyBody: 'Try a broader spelling or clear the search.',
  note: 'This list is incomplete and always will be. If a name belongs here and it’s missing, use Submit to send the evidence.',
  seedNote:
    'This list is stored on your device. Record and map links appear where a record has been published.',
} as const;

export const MEMORIAL_ACTIONS = {
  openRecord: 'Open place record',
  openMaps: 'Open in Maps',
  methodology: 'Methodology',
  submit: 'Submit a lead',
} as const;
