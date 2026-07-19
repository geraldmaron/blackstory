/**
 * Public "why this appears" explanation surface. Renders the auditable payload produced by
 * `@repo/domain`'s `buildPublicWhyThisAppears` (composing relevance explanation and
 * `notabilityBasis`). This component performs no editorial composition of its own; it only
 * presents the already-validated `PublicWhyThisAppears` structure plus optional claim-citation
 * resolution so readers see named sources (and hrefs) instead of opaque evidence-id counts.
 *
 * Never renders a score: `notabilityBasis` renders as a labeled, sourced list (criterion label +
 * record-specific note + citation links). A trauma-content notice and honest coverage notes
 * render additively alongside the explanation, never in place of it.
 *
 * Default `variant="flat"` fits entity pages that already own the section `h2`. Pass
 * `variant="card"` when a standalone titled Card is required.
 */

import React from 'react';
import { Card, EmptyState, Notice } from '@repo/ui';
import type { PublicWhyThisAppears } from '@repo/domain';
import { WHY_THIS_APPEARS_COPY } from './copy';

export type WhyAppearsCitation = {
  readonly id: string;
  readonly source: string;
  readonly label: string;
  readonly href?: string;
};

export type WhyThisAppearsProps = {
  readonly result: PublicWhyThisAppears;
  /** Distinguishes multiple mounts on the same page (e.g. a list of search results) in generated
   * element ids. Defaults to a stable value safe for a single per-page mount. */
  readonly instanceId?: string;
  /** Flat body for section-owned headings; card wraps a titled Card for standalone mounts. */
  readonly variant?: 'flat' | 'card';
  /** Optional claim-id → citation map so inclusion evidence can show named, linkable sources. */
  readonly evidenceById?: Readonly<Record<string, WhyAppearsCitation>>;
};

function CitationList({
  evidenceIds,
  evidenceById,
}: {
  readonly evidenceIds: readonly string[];
  readonly evidenceById: Readonly<Record<string, WhyAppearsCitation>> | undefined;
}) {
  if (evidenceIds.length === 0) {
    return <p className="ds-sans">{WHY_THIS_APPEARS_COPY.noLinkedCitations}</p>;
  }

  const resolved = evidenceIds
    .map((id) => evidenceById?.[id])
    .filter((citation): citation is WhyAppearsCitation => citation !== undefined);

  if (resolved.length === 0) {
    return <p className="ds-sans">{WHY_THIS_APPEARS_COPY.noLinkedCitations}</p>;
  }

  return (
    <ul className="ds-why-appears__citations" aria-label={WHY_THIS_APPEARS_COPY.citationsHeading}>
      {resolved.map((citation) => (
        <li key={citation.id} className="ds-sans">
          {citation.href ? (
            <a href={citation.href} rel="noopener noreferrer">
              {citation.source}
            </a>
          ) : (
            <span>{citation.source}</span>
          )}
          {citation.label.trim().length > 0 ? (
            <span className="ds-mono"> — {citation.label}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function WhyThisAppearsBody({
  result,
  instanceId,
  showAuditableTag,
  evidenceById,
}: {
  readonly result: PublicWhyThisAppears;
  readonly instanceId: string;
  readonly showAuditableTag: boolean;
  readonly evidenceById: Readonly<Record<string, WhyAppearsCitation>> | undefined;
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
                <CitationList evidenceIds={item.evidenceIds} evidenceById={evidenceById} />
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
  evidenceById,
}: WhyThisAppearsProps) {
  const body = (
    <WhyThisAppearsBody
      result={result}
      instanceId={instanceId}
      showAuditableTag={variant === 'flat'}
      evidenceById={evidenceById}
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
