/**
 * schema.org `Article` JSON-LD for a `FactRecord` (BB-086 acceptance criterion 6).
 *
 * Canonical facts are NEVER wrapped in `ClaimReview` — that schema.org type asserts "a review of
 * someone else's claim," which misdescribes a first-party canonical assertion and is outside
 * Google's `ClaimReview` eligibility rules for this use. `ClaimReview` is reserved exclusively
 * for the BB-088 myths/pre-bunking surface, a different page type entirely. `assertNeverClaimReview`
 * below is a standing structural guard (and the direct subject of `./jsonld.test.ts`'s adversarial
 * case) proving this module can never regress into emitting one.
 *
 * `version` mirrors the fact's current revision number (the Wikipedia-oldid permalink target);
 * `dateModified` is the current revision's timestamp; a `correction` (schema.org `Correction`) is
 * only emitted when the current status is `corrected`.
 */
import { CLAIM_TYPE_ABOUT_SCHEMA_TYPE } from './claim-type.js';
import { buildFactPath } from './ids.js';
import { currentFactRevision } from './revision.js';
import type { FactRecord } from './record.js';
import type { FactCitation } from './citation.js';

export type FactJsonLdOptions = {
  /** Origin to prefix the canonical path with, e.g. "https://blackbook.example.org". Omitted
   * when the caller wants a root-relative `@id` (e.g. for local/dev rendering). */
  readonly baseUrl?: string;
};

function absoluteUrl(path: string, baseUrl: string | undefined): string {
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
}

function citationToJsonLd(citation: FactCitation): Record<string, unknown> {
  const url = citation.archivedUrl ?? citation.csl.URL ?? citation.url;
  return {
    '@type': 'CreativeWork',
    name: citation.csl.title ?? citation.csl.id,
    ...(url ? { url } : {}),
    ...(citation.accessedAt ? { dateAccessed: citation.accessedAt } : {}),
  };
}

/**
 * Builds the `Article` JSON-LD document for one fact. This is the ONLY JSON-LD `@type` this
 * module ever emits at the top level (see `assertNeverClaimReview` below for the enforced
 * invariant).
 */
export function buildFactArticleJsonLd(
  fact: FactRecord,
  options: FactJsonLdOptions = {},
): Record<string, unknown> {
  const canonicalUrl = absoluteUrl(buildFactPath(fact.id, fact.slug), options.baseUrl);
  const revision = currentFactRevision(fact.revisions);
  const aboutType = CLAIM_TYPE_ABOUT_SCHEMA_TYPE[fact.claimType];

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': canonicalUrl,
    url: canonicalUrl,
    headline: fact.shortStatement,
    articleBody: fact.statement,
    dateModified: revision?.timestamp ?? fact.updatedAt,
    ...(revision ? { version: revision.revisionNumber } : {}),
    about: fact.subjects.map((subject) => ({
      '@type': aboutType,
      identifier: subject.entityId,
    })),
    citation: fact.citations.map(citationToJsonLd),
  };

  if (fact.status === 'corrected') {
    jsonLd.correction = {
      '@type': 'CorrectionComment',
      text: fact.confidenceNote ?? 'This fact record has been corrected. See its revision history.',
    };
  }

  return jsonLd;
}

/**
 * Fail-closed structural guard: throws if a JSON-LD document (this module's output, or any
 * document a caller is about to emit for a canonical fact page) declares `@type: "ClaimReview"`
 * anywhere at the top level. Canonical facts must never be described as a review of a claim
 * (BB-086 AC6) — `ClaimReview` belongs only to the BB-088 myths surface.
 */
export function assertNeverClaimReview(jsonLd: Record<string, unknown>): void {
  if (jsonLd['@type'] === 'ClaimReview') {
    throw new Error('Canonical FactRecord JSON-LD must never be @type "ClaimReview" (BB-086 AC6)');
  }
}
