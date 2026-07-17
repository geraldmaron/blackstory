/**
 * Approved presentation copy for the BB-054 "why this appears" surface. Headings and static
 * labels only — the substantive explanation, notabilityBasis, story dimensions, missing-
 * perspective notes, and trauma-content disclaimer text all come from
 * `@black-book/domain`'s `buildPublicWhyThisAppears` (BB-054) and its own approved-language
 * registries; nothing editorial is authored in this file.
 */

export const WHY_THIS_APPEARS_COPY = {
  heading: 'Why this appears',
  auditableTag: 'Auditable basis \u2014 not a score',
  basisHeading: 'Notability basis',
  noBasisRecorded: 'No notability basis has been recorded for this record yet.',
  missingPerspectiveHeading: 'Coverage note',
  sourceCountSuffix: (count: number) => (count === 1 ? '1 documented source' : `${count} documented sources`),
} as const;
