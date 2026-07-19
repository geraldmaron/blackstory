/**
 * Public "why this appears" explanation surface. Renders the auditable payload produced by
 * `@repo/domain`'s `buildPublicWhyThisAppears` (composing relevance explanation and
 * `notabilityBasis`). This component performs no editorial composition of its own; it only
 * presents the already-validated `PublicWhyThisAppears` structure.
 *
 * Never renders a score: `notabilityBasis` renders as a labeled, sourced, auditable list (rubric
 * label + reviewer note + evidence-source count); nothing here is a numeric ranking. A trauma-
 * content notice (from the shared disclaimer registry) and honest "coverage note" missing-
 * perspective indicators render additively alongside the explanation, never in place of it.
 *
 * Default `variant="flat"` fits entity pages that already own the section `h2`. Pass
 * `variant="card"` when a standalone titled Card is required.
 */

import React from 'react';
import { Card, EmptyState, Notice } from '@repo/ui';
import type { PublicWhyThisAppears } from '@repo/domain';
import { WHY_THIS_APPEARS_COPY } from './copy';

export type WhyThisAppearsProps = {
  readonly result: PublicWhyThisAppears;
  /** Distinguishes multiple mounts on the same page (e.g. a list of search results) in generated
   * element ids. Defaults to a stable value safe for a single per-page mount. */
  readonly instanceId?: string;
  /** Flat body for section-owned headings; card wraps a titled Card for standalone mounts. */
  readonly variant?: 'flat' | 'card';
};

function WhyThisAppearsBody({
  result,
  instanceId,
  showAuditableTag,
}: {
  readonly result: PublicWhyThisAppears;
  readonly instanceId: string;
  readonly showAuditableTag: boolean;
}) {
  const basisHeadingId = `${instanceId}-basis-heading`;
  const coverageHeadingId = `${instanceId}-coverage-heading`;

  return (
    <>
      <p className="ds-sans ds-why-appears__explanation">{result.explanation}</p>
      {showAuditableTag ? (
        <p className="ds-mono ds-why-appears__tag">{WHY_THIS_APPEARS_COPY.auditableTag}</p>
      ) : null}

      {result.traumaContentNotice.warranted && result.traumaContentNotice.disclaimer ? (
        <Notice tone="warning" title={result.traumaContentNotice.disclaimer.title}>
          <p style={{ margin: 0 }}>{result.traumaContentNotice.disclaimer.body}</p>
        </Notice>
      ) : null}

      <section aria-labelledby={basisHeadingId} className="ds-why-appears__block">
        <h3 id={basisHeadingId} className="ds-subheading">
          {WHY_THIS_APPEARS_COPY.basisHeading}
        </h3>
        {result.notabilityBasis.length === 0 ? (
          <EmptyState title={WHY_THIS_APPEARS_COPY.basisHeading}>
            {WHY_THIS_APPEARS_COPY.noBasisRecorded}
          </EmptyState>
        ) : (
          <ol className="ds-qualify-list" aria-label={WHY_THIS_APPEARS_COPY.basisHeading}>
            {result.notabilityBasis.map((item, index) => (
              <li key={`${item.criterion}_${index}`}>
                <span className="ds-mono">{item.criterionLabel}</span>
                <p className="ds-sans" style={{ margin: 0, fontWeight: 400 }}>
                  {item.note}
                </p>
                {item.evidenceIds.length > 0 ? (
                  <p className="ds-mono" style={{ margin: 0 }}>
                    {WHY_THIS_APPEARS_COPY.sourceCountSuffix(item.evidenceIds.length)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {result.missingPerspectiveIndicators.length > 0 ? (
        <section aria-labelledby={coverageHeadingId} className="ds-why-appears__block ds-stack">
          <h3 id={coverageHeadingId} className="ds-subheading">
            {WHY_THIS_APPEARS_COPY.missingPerspectiveHeading}
          </h3>
          <ul>
            {result.missingPerspectiveIndicators.map((indicator) => (
              <li key={indicator.dimension} className="ds-sans">
                {indicator.note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export function WhyThisAppears({
  result,
  instanceId = 'why-this-appears',
  variant = 'flat',
}: WhyThisAppearsProps) {
  const body = (
    <WhyThisAppearsBody
      result={result}
      instanceId={instanceId}
      showAuditableTag={variant === 'flat'}
    />
  );

  if (variant === 'card') {
    return (
      <Card
        title={WHY_THIS_APPEARS_COPY.heading}
        meta={<span className="ds-mono">{WHY_THIS_APPEARS_COPY.auditableTag}</span>}
      >
        {body}
      </Card>
    );
  }

  return <div className="ds-why-appears">{body}</div>;
}
