/**
 * Content-negotiated JSON export for a canonical fact (BB-086 AC6): CSL-JSON citations plus the
 * Black Book extension block, wrapped with stable permalink metadata. Canonical facts are exported
 * as data records only — never as ClaimReview (see `assertNeverClaimReview` in the JSON-LD helper).
 */
import {
  assertNeverClaimReview,
  buildFactArticleJsonLd,
  type FactCitation,
  type FactRecord,
} from '@black-book/domain';
import { canonicalFactJsonUrl, canonicalFactPageUrl } from './resolve-public-fact';

export type FactJsonExport = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly slug: string;
  readonly canonicalUrl: string;
  readonly jsonUrl: string;
  readonly statement: string;
  readonly shortStatement: string;
  readonly claimType: string;
  readonly status: string;
  readonly confidence: string;
  readonly confidenceNote?: string;
  readonly subjects: FactRecord['subjects'];
  readonly citations: readonly FactCitation[];
  readonly revisions: FactRecord['revisions'];
  readonly jsonLd: Record<string, unknown>;
};

export function buildFactJsonExport(fact: FactRecord, baseUrl?: string): FactJsonExport {
  const jsonLd = buildFactArticleJsonLd(fact, baseUrl ? { baseUrl } : {});
  assertNeverClaimReview(jsonLd);

  return {
    schemaVersion: 1,
    id: fact.id,
    slug: fact.slug,
    canonicalUrl: baseUrl ? `${baseUrl.replace(/\/$/, '')}${canonicalFactPageUrl(fact)}` : canonicalFactPageUrl(fact),
    jsonUrl: canonicalFactJsonUrl(fact, baseUrl),
    statement: fact.statement,
    shortStatement: fact.shortStatement,
    claimType: fact.claimType,
    status: fact.status,
    confidence: fact.confidence,
    ...(fact.confidenceNote ? { confidenceNote: fact.confidenceNote } : {}),
    subjects: fact.subjects,
    citations: fact.citations,
    revisions: fact.revisions,
    jsonLd,
  };
}
