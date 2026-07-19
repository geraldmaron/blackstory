/**
 * Approved presentation copy for the "why this appears" surface. Headings and static
 * labels only — substantive explanation, notabilityBasis, story dimensions, missing-
 * perspective notes, and trauma-content disclaimer text all come from
 * `@repo/domain`'s `buildPublicWhyThisAppears` and its own approved-language
 * registries; nothing editorial is authored in this file beyond framing that inclusion
 * reasons must cite external sources BlackStory assembled, not originated.
 */

export const WHY_THIS_APPEARS_COPY = {
  heading: 'Why this appears',
  auditableTag: 'Cited from external sources \u2014 not a ranking score',
  basisHeading: 'Inclusion evidence',
  noBasisRecorded: 'No inclusion evidence with linked citations has been recorded for this record yet.',
  noLinkedCitations: 'No linked source citations for this inclusion reason yet.',
  missingPerspectiveHeading: 'Coverage note',
  citationsHeading: 'Sources',
} as const;
