/**
 * Approved presentation copy for the "why this appears" surface. Headings and static
 * labels only the substantive explanation, notabilityBasis, story dimensions, missing-
 * perspective notes, and trauma-content disclaimer text all come from
 * `@repo/domain`'s `buildPublicWhyThisAppears` and its own approved-language
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
