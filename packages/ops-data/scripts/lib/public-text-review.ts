/**
 * The claim gate sees structured claims only, while readers get the summary, context and impact
 * statement as well. A new record therefore also needs a review bound by hash to exactly what it
 * will publish: change one word or one claim and the review no longer applies.
 */
import { createHash } from 'node:crypto';

export const PUBLIC_TEXT_REVIEW_ARTIFACT = 'public-text-review';

export type PublicTextEntry = {
  readonly id: string;
  readonly displayName: string;
  readonly summary: string;
  readonly historicalContext?: string;
  readonly impactStatement?: string;
  readonly claims?: readonly {
    readonly predicate: string;
    readonly object: unknown;
    readonly citationHref?: string;
  }[];
};

export type PublicTextReview = {
  readonly entityId: string;
  readonly textHash: string;
  readonly decision: string;
  readonly reviewerModelFamily: string | null;
  readonly producerModelFamily: string | null;
};

export function publicTextHash(entry: PublicTextEntry): string {
  const claims = (entry.claims ?? [])
    .map((claim) => [claim.predicate, String(claim.object), claim.citationHref ?? ''])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const text = [
    entry.displayName,
    entry.summary,
    entry.historicalContext ?? '',
    entry.impactStatement ?? '',
  ];
  return createHash('sha256')
    .update(JSON.stringify([text, claims]))
    .digest('hex');
}

/** Model family strings vary (`claude-sonnet-5`, `openai`), so independence compares providers. */
export function providerOf(modelFamily: string | null): 'anthropic' | 'openai' | null {
  if (!modelFamily) return null;
  if (/^(anthropic|claude)/iu.test(modelFamily)) return 'anthropic';
  if (/^(openai|gpt-|o\d)/iu.test(modelFamily)) return 'openai';
  return null;
}

export type PublicTextAssessment = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export function assessPublicTextReview(
  entry: PublicTextEntry,
  reviews: readonly PublicTextReview[],
): PublicTextAssessment {
  const textHash = publicTextHash(entry);
  const matching = reviews.filter((r) => r.entityId === entry.id && r.textHash === textHash);
  if (matching.length === 0) {
    return { ok: false, detail: 'No review covers this exact public text and claim set' };
  }
  // A later approval of unchanged text is a second opinion, not a resolution of the finding.
  if (matching.some((r) => r.decision !== 'approve')) {
    return { ok: false, detail: 'A review rejected this exact text; it must change before re-review' };
  }
  const independent = matching.some((r) => {
    const reviewer = providerOf(r.reviewerModelFamily);
    const producer = providerOf(r.producerModelFamily);
    return reviewer !== null && producer !== null && reviewer !== producer;
  });
  return independent
    ? { ok: true }
    : { ok: false, detail: 'The drafter and reviewer of this text are not shown to be different providers' };
}

export const PUBLIC_TEXT_REVIEWS_SQL = `
SELECT a.extensions->>'entityId' AS "entityId", a.content_hash AS "textHash", r.decision,
       r.reviewer_model_family AS "reviewerModelFamily",
       r.producer_model_family AS "producerModelFamily"
FROM research.artifacts a
JOIN research.review_decisions r ON r.artifact_id = a.id
WHERE a.artifact_type = '${PUBLIC_TEXT_REVIEW_ARTIFACT}' AND a.extensions->>'entityId' = ANY($1::text[])`;

export async function loadPublicTextReviews(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> },
  entityIds: readonly string[],
): Promise<readonly PublicTextReview[]> {
  if (entityIds.length === 0) return [];
  return (await client.query(PUBLIC_TEXT_REVIEWS_SQL, [entityIds])).rows as PublicTextReview[];
}
