/**
 * Injects per-fact schema.org Article JSON-LD. Never emits ClaimReview the domain
 * helper already enforces that invariant before this component serializes the payload.
 */
import React from 'react';
import { assertNeverClaimReview, buildFactArticleJsonLd, type FactRecord } from '@black-book/domain';

export type FactJsonLdScriptProps = {
  readonly fact: FactRecord;
  readonly baseUrl?: string;
};

export function FactJsonLdScript({ fact, baseUrl }: FactJsonLdScriptProps) {
  const jsonLd = buildFactArticleJsonLd(fact, baseUrl ? { baseUrl } : {});
  assertNeverClaimReview(jsonLd);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
