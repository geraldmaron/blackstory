/**
 * BB-054 public "why this appears" explanation surface. Renders the auditable payload produced by
 * `@black-book/domain`'s `buildPublicWhyThisAppears` (BB-054, composing BB-040's relevance
 * explanation and BB-090's notabilityBasis) — this component performs no editorial composition of
 * its own; it only presents the already-validated `PublicWhyThisAppears` structure.
 *
 * Never renders a score: `notabilityBasis` renders as a labeled, sourced, auditable list (rubric
 * label + reviewer note + evidence-source count); nothing here is a numeric ranking. A trauma-
 * content notice (from the shared BB-095 disclaimer registry) and honest "coverage note" missing-
 * perspective indicators render additively alongside the explanation — never in place of it.
 *
 * INTEGRATION POINT (documented, not wired live — parent mount is out of this bead's file-
 * ownership boundary): a real caller resolves a `PublicWhyThisAppears` value via
 * `buildPublicWhyThisAppears` from `@black-book/domain` (typically from an entity's
 * `relevanceExplanation`/`historicalContext`/claim text and BB-090 `notabilityBasis`) and mounts
 * `<WhyThisAppears result={...} />` on the entity detail page.
 */

import React from 'react';
import { Card, EmptyState, Notice } from '@black-book/ui';
import type { PublicWhyThisAppears } from '@black-book/domain';
import { WHY_THIS_APPEARS_COPY } from './copy';

export type WhyThisAppearsProps = {
  readonly result: PublicWhyThisAppears;
  /** Distinguishes multiple mounts on the same page (e.g. a list of search results) in generated
   * element ids. Defaults to a stable value safe for a single per-page mount. */
  readonly instanceId?: string;
};

export function WhyThisAppears({ result, instanceId = 'why-this-appears' }: WhyThisAppearsProps) {
  const basisHeadingId = `${instanceId}-basis-heading`;
  const coverageHeadingId = `${instanceId}-coverage-heading`;

  return (
    <Card
      title={WHY_THIS_APPEARS_COPY.heading}
      meta={<span className="bb-mono">{WHY_THIS_APPEARS_COPY.auditableTag}</span>}
    >
      <p className="bb-sans" style={{ margin: 0 }}>
        {result.explanation}
      </p>

      {result.traumaContentNotice.warranted && result.traumaContentNotice.disclaimer ? (
        <Notice tone="warning" title={result.traumaContentNotice.disclaimer.title}>
          <p style={{ margin: 0 }}>{result.traumaContentNotice.disclaimer.body}</p>
        </Notice>
      ) : null}

      <section aria-labelledby={basisHeadingId} style={{ marginTop: 'var(--bb-space-4)' }}>
        <h4 id={basisHeadingId} className="bb-sans" style={{ margin: 0 }}>
          {WHY_THIS_APPEARS_COPY.basisHeading}
        </h4>
        {result.notabilityBasis.length === 0 ? (
          <EmptyState title={WHY_THIS_APPEARS_COPY.basisHeading}>
            {WHY_THIS_APPEARS_COPY.noBasisRecorded}
          </EmptyState>
        ) : (
          <ol className="bb-qualify-list" aria-label={WHY_THIS_APPEARS_COPY.basisHeading}>
            {result.notabilityBasis.map((item, index) => (
              <li key={`${item.criterion}_${index}`}>
                <span className="bb-mono">{item.criterionLabel}</span>
                <p className="bb-sans" style={{ margin: 0, fontWeight: 400 }}>
                  {item.note}
                </p>
                <p className="bb-mono" style={{ margin: 0 }}>
                  {WHY_THIS_APPEARS_COPY.sourceCountSuffix(item.evidenceIds.length)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {result.missingPerspectiveIndicators.length > 0 ? (
        <section
          aria-labelledby={coverageHeadingId}
          className="bb-stack"
          style={{ marginTop: 'var(--bb-space-4)' }}
        >
          <h4 id={coverageHeadingId} className="bb-sans" style={{ margin: 0 }}>
            {WHY_THIS_APPEARS_COPY.missingPerspectiveHeading}
          </h4>
          <ul>
            {result.missingPerspectiveIndicators.map((indicator) => (
              <li key={indicator.dimension} className="bb-sans">
                {indicator.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}
