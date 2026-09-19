/**
 * Publish-time archive-pointer selection for public claim projections.
 *
 * Public readers never inspect evidence storage. This adapter joins an exact cited URL to a
 * completed SPN2 job, applies the standing preservation decision, and emits only the two public
 * pointer fields. Private storage references and preservation-policy details stay behind the
 * publication boundary.
 */
import { normalizeCitationUrl, parseWaybackCaptureUrl } from '@repo/domain';
import { assertContract, type PreservationDecision } from '@repo/research-kernel';

export type PublicCitationArchive = {
  readonly archivedUrl: string;
  readonly archivedAt: string;
};

export type ReviewedCitationCapture = {
  readonly claimId: string;
  readonly sourceUrl: string;
  readonly sourceItemId: string;
  readonly captureId: string;
  readonly contentHashDigest: string;
};

export type CitationArchiveCandidateRow = {
  readonly claim_id: string;
  readonly source_url: string;
  readonly capture_id: string;
  readonly content_hash_digest: string;
  readonly retention_revoked_at: string | null;
  readonly preservation_state: string;
  readonly preservation_decision: unknown;
  readonly current_preservation_decision: unknown;
  readonly preservation_result: unknown;
};

export type CitationArchiveQueryable = {
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

/** A signed release is immutable; archive hydration belongs in a newly built release. */
export function assertArchiveHydrationTargetIsUnsigned(
  signedManifest: unknown,
  writeCount: number,
): void {
  if (writeCount === 0) return;
  if (
    signedManifest === null ||
    typeof signedManifest !== 'object' ||
    Array.isArray(signedManifest)
  ) {
    throw new Error('Cannot verify whether the archive hydration target is signed');
  }
  const manifest = asRecord(signedManifest);
  if (Object.keys(manifest).length > 0) {
    throw new Error(
      'Incremental writes require a new release; the target release is already signed',
    );
  }
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function currentPublicArchiveDecision(
  value: unknown,
  sourceUrl: string,
  publicationTime: number,
): PreservationDecision | null {
  try {
    const decision = assertContract('PreservationDecision', value);
    const reviewedAt = Date.parse(decision.reviewedAt);
    const expiresAt = Date.parse(decision.expiresAt);
    if (
      normalizeCitationUrl(decision.sourceUrl) !== sourceUrl ||
      !decision.allowArchive ||
      decision.sensitivity !== 'public' ||
      reviewedAt > publicationTime ||
      expiresAt <= publicationTime
    )
      return null;
    return decision;
  } catch {
    return null;
  }
}

function eligibleArchive(
  row: CitationArchiveCandidateRow,
  publicationTime: number,
): PublicCitationArchive | null {
  if (row.retention_revoked_at !== null || row.preservation_state !== 'anchored') return null;
  const sourceUrl = normalizeCitationUrl(row.source_url);
  if (sourceUrl === null) return null;

  if (
    currentPublicArchiveDecision(row.preservation_decision, sourceUrl, publicationTime) === null ||
    currentPublicArchiveDecision(row.current_preservation_decision, sourceUrl, publicationTime) ===
      null
  ) {
    return null;
  }

  const result = asRecord(row.preservation_result);
  if (
    result.status !== 'anchored' ||
    typeof result.waybackCaptureUrl !== 'string' ||
    typeof result.waybackCapturedAt !== 'string'
  ) {
    return null;
  }
  const pointer = parseWaybackCaptureUrl(result.waybackCaptureUrl, sourceUrl);
  if (pointer === null || pointer.capturedAt !== result.waybackCapturedAt) return null;
  return { archivedUrl: pointer.url, archivedAt: pointer.capturedAt };
}

/**
 * Select one reviewed archive revision per claim and original URL. Newest eligible timestamp
 * wins within the reviewed capture set; capture id and digest break equal-time ties.
 */
export function selectPublicCitationArchives(
  rows: readonly CitationArchiveCandidateRow[],
  publishedAt: string,
): ReadonlyMap<string, PublicCitationArchive> {
  const publicationTime = Date.parse(publishedAt);
  if (!Number.isFinite(publicationTime)) throw new Error('publishedAt must be a valid timestamp');
  const selected = new Map<string, PublicCitationArchive & { readonly revisionKey: string }>();
  for (const row of rows) {
    const sourceUrl = normalizeCitationUrl(row.source_url);
    if (sourceUrl === null) continue;
    const archive = eligibleArchive(row, publicationTime);
    if (archive === null) continue;
    const revisionKey = `${archive.archivedAt}\u001f${row.capture_id}\u001f${row.content_hash_digest}`;
    const key = citationArchiveKey(row.claim_id, sourceUrl);
    const previous = selected.get(key);
    if (previous === undefined || revisionKey > previous.revisionKey) {
      selected.set(key, { ...archive, revisionKey });
    }
  }
  return new Map(
    [...selected].map(([key, { archivedUrl, archivedAt }]) => [key, { archivedUrl, archivedAt }]),
  );
}

/** Read only completed SPN2 jobs. Arbitrary archive-looking evidence JSON is never selected. */
export async function loadPublicCitationArchives(
  db: CitationArchiveQueryable,
  reviewedCaptures: readonly ReviewedCitationCapture[],
  publishedAt: string,
  options: { readonly lock?: boolean } = {},
): Promise<ReadonlyMap<string, PublicCitationArchive>> {
  const allowed = reviewedCaptures
    .flatMap((capture) => {
      const sourceUrl = normalizeCitationUrl(capture.sourceUrl);
      return sourceUrl === null || capture.claimId.length === 0 ? [] : [{ ...capture, sourceUrl }];
    })
    .sort((left, right) =>
      [left.claimId, left.sourceUrl, left.sourceItemId, left.captureId, left.contentHashDigest]
        .join('\u001f')
        .localeCompare(
          [
            right.claimId,
            right.sourceUrl,
            right.sourceItemId,
            right.captureId,
            right.contentHashDigest,
          ].join('\u001f'),
        ),
    );
  if (allowed.length === 0) return new Map();
  const lockClause = options.lock ? '\n      FOR UPDATE OF origin, job' : '';
  const result = await db.query<CitationArchiveCandidateRow>(
    `WITH reviewed_capture(claim_id,source_url,source_item_id,capture_id,content_hash_digest) AS (
       SELECT * FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[])
     )
     SELECT reviewed_capture.claim_id,
            origin.source_url,
            origin.capture_id,
            capture.content_hash_digest,
            origin.retention_revoked_at,
            job.state AS preservation_state,
            job.decision AS preservation_decision,
            origin.storage_object->'preservationDecision' AS current_preservation_decision,
            job.result AS preservation_result
       FROM reviewed_capture
       JOIN evidence.capture_origins origin
         ON origin.source_url=reviewed_capture.source_url
        AND origin.source_item_id=reviewed_capture.source_item_id
        AND origin.capture_id=reviewed_capture.capture_id
       JOIN evidence.source_captures capture
         ON capture.id=origin.capture_id
        AND capture.content_hash_digest=reviewed_capture.content_hash_digest
       JOIN research.preservation_jobs job
         ON job.source_url=origin.source_url
        AND job.content_hash_digest=capture.content_hash_digest
      WHERE origin.retention_revoked_at IS NULL
        AND job.state='anchored'
      ORDER BY reviewed_capture.claim_id,origin.source_url,origin.capture_id,capture.content_hash_digest${lockClause}`,
    [
      allowed.map((capture) => capture.claimId),
      allowed.map((capture) => capture.sourceUrl),
      allowed.map((capture) => capture.sourceItemId),
      allowed.map((capture) => capture.captureId),
      allowed.map((capture) => capture.contentHashDigest),
    ],
  );
  return selectPublicCitationArchives(result.rows, publishedAt);
}

function citationArchiveKey(claimId: string, sourceUrl: string): string {
  return `${claimId}\u001f${sourceUrl}`;
}

/** Add verified archive fields to claims while retaining citationHref as the original source. */
export function attachPublicCitationArchives(
  projection: unknown,
  archives: ReadonlyMap<string, PublicCitationArchive>,
): unknown {
  const record = asRecord(projection);
  if (!Array.isArray(record.claims)) return projection;
  let changed = false;
  const claims = record.claims.map((rawClaim) => {
    const claim = asRecord(rawClaim);
    const { archivedUrl: previousUrl, archivedAt: previousAt, ...withoutPreviousArchive } = claim;
    const href =
      typeof claim.citationHref === 'string' ? normalizeCitationUrl(claim.citationHref) : null;
    const claimId = typeof claim.id === 'string' ? claim.id : null;
    const archive =
      href === null || claimId === null
        ? undefined
        : archives.get(citationArchiveKey(claimId, href));
    if (archive === undefined) {
      if (previousUrl === undefined && previousAt === undefined) return rawClaim;
      changed = true;
      return withoutPreviousArchive;
    }
    if (previousUrl !== archive.archivedUrl || previousAt !== archive.archivedAt) changed = true;
    return { ...withoutPreviousArchive, ...archive };
  });
  return changed ? { ...record, claims } : projection;
}
