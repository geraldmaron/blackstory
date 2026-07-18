/**
 * Public-payload numeric policy — the CANONICAL statement (2026-07-18, supersedes the
 * scattered per-file phrasings; those sites now point here).
 *
 * BANNED from every public payload: any numeric that scores, ranks, or weighs an entity or
 * claim — notability scores, relevance/composite scores, confidence scores, feature values.
 * The public register for these is always a bounded label vocabulary (confidenceLevel
 * high/medium/low, notability rubric labels, sensitivity classes). Enforcement lives in
 * `relevance/public.ts` (`assertPublicRelevanceHasNoScore`), `relevance/why.ts`, and the
 * leaf-walking test in `relevance/notability-gate.test.ts`.
 *
 * PERMITTED public numerics — an exhaustive list; anything not in it is banned by default:
 *
 * 1. Geographic coordinates at the record's allowed public precision (lat/lng/geohash —
 *    `geography/precision.ts` governs precision, never this module).
 * 2. The two server-internal ranking counts explicitly enumerated on
 *    `publicSearchIndexSchema` (`relatedCount`, `claimCount`) — read server-side only and
 *    never projected into a client-facing result.
 * 3. Published government statistics (census counts and the like), ONLY when the carrying
 *    document structurally requires its provenance: source identifier, source URL,
 *    vintage/decade, retrieval timestamp, and content hash. A count without provenance is
 *    not a statistic, it is an assertion — schemas for statistics collections must make the
 *    provenance fields required (see `censusCountyDecadeSchema` in @repo/firebase),
 *    and writers should call `assertPublishedStatisticProvenance` before persisting.
 *
 * Why the distinction: entity scoring is editorial judgment this project deliberately keeps
 * non-numeric in public ("evidence before assertion" — a number would imply a precision of
 * judgment the archive does not claim). A decennial census count is someone else's published
 * measurement; the archive's job is to carry it faithfully WITH its provenance, not to
 * suppress it.
 */

/** The exhaustive permitted-category ids, for tooling and review checklists. */
export const PUBLIC_NUMERIC_PERMITTED_CATEGORIES = [
  'geographic_coordinates_public_precision',
  'search_index_server_internal_counts',
  'published_government_statistics_with_provenance',
] as const;

export type PublicNumericPermittedCategory = (typeof PUBLIC_NUMERIC_PERMITTED_CATEGORIES)[number];

/** The provenance a published-statistic document must carry for its numeric fields to fall
 * under permitted category 3. Shapes are intentionally loose here (schemas own exactness). */
export type PublishedStatisticProvenance = {
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly contentHash: string;
};

/** Fails closed when a statistics document is missing any provenance leg. Writers call this
 * before persisting a document that carries published-statistic numerics (category 3). */
export function assertPublishedStatisticProvenance(
  doc: Partial<PublishedStatisticProvenance> & { readonly [key: string]: unknown },
): void {
  const missing = (['source', 'sourceUrl', 'retrievedAt', 'contentHash'] as const).filter(
    (field) => typeof doc[field] !== 'string' || (doc[field] as string).trim().length === 0,
  );
  if (missing.length > 0) {
    throw new Error(
      `Published-statistic document is missing provenance (${missing.join(', ')}) — ` +
        'numeric statistics without provenance are banned from public payloads ' +
        '(public-numeric-policy.ts, permitted category 3).',
    );
  }
}
