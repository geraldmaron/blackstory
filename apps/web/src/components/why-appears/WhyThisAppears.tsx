/**
 * Public "why this appears" explanation surface. Renders the auditable payload produced by
 * `@repo/domain`'s `buildPublicWhyThisAppears` (composing relevance explanation and
 * `notabilityBasis`). This component performs no editorial composition of its own; it only
 * presents the already-validated `PublicWhyThisAppears` structure plus optional claim-citation
 * resolution so readers see named sources (and hrefs) instead of opaque evidence-id counts.
 *
 * Never renders a score: `notabilityBasis` renders as criterion groups (label once) with prose
 * notes and a deduped citation list. A trauma-content notice and honest coverage notes render
 * additively alongside the explanation, never in place of it.
 *
 * Default `variant="flat"` fits entity pages that already own the section `h2`. Pass
 * `variant="card"` when a standalone titled Card is required.
 */

import React from 'react';
import { Card, EmptyState, Notice } from '@repo/ui';
import type { PublicNotabilityBasisItem, PublicWhyThisAppears } from '@repo/domain';
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

type BasisGroup = {
  readonly criterion: PublicNotabilityBasisItem['criterion'];
  readonly criterionLabel: string;
  readonly items: readonly PublicNotabilityBasisItem[];
};

function groupBasisByCriterion(items: readonly PublicNotabilityBasisItem[]): readonly BasisGroup[] {
  const groups: BasisGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.criterion === item.criterion) {
      groups[groups.length - 1] = {
        ...last,
        items: [...last.items, item],
      };
      continue;
    }
    groups.push({
      criterion: item.criterion,
      criterionLabel: item.criterionLabel,
      items: [item],
    });
  }
  return groups;
}

function uniqueCitationsForGroup(
  items: readonly PublicNotabilityBasisItem[],
  evidenceById: Readonly<Record<string, WhyAppearsCitation>> | undefined,
): {
  readonly resolved: readonly WhyAppearsCitation[];
  readonly hadEvidenceIds: boolean;
} {
  const seen = new Set<string>();
  const resolved: WhyAppearsCitation[] = [];
  let hadEvidenceIds = false;

  for (const item of items) {
    for (const id of item.evidenceIds) {
      hadEvidenceIds = true;
      const citation = evidenceById?.[id];
      if (!citation) continue;
      const key = citation.href?.trim() || `${citation.source}|${citation.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push(citation);
    }
  }

  return { resolved, hadEvidenceIds };
}

function CitationList({
  items,
  evidenceById,
}: {
  readonly items: readonly PublicNotabilityBasisItem[];
  readonly evidenceById: Readonly<Record<string, WhyAppearsCitation>> | undefined;
}) {
  const { resolved, hadEvidenceIds } = uniqueCitationsForGroup(items, evidenceById);

  if (!hadEvidenceIds || resolved.length === 0) {
    return (
      <p className="ds-sans ds-why-appears__cite-gap">{WHY_THIS_APPEARS_COPY.noLinkedCitations}</p>
    );
  }

  return (
    <ul className="ds-why-appears__citations" aria-label={WHY_THIS_APPEARS_COPY.citationsHeading}>
      {resolved.map((citation) => {
        const linkText =
          citation.label.trim().length > 0 ? citation.label.trim() : citation.source.trim();
        const showHost =
          citation.label.trim().length > 0 &&
          citation.source.trim().length > 0 &&
          !citation.label.toLowerCase().includes(citation.source.toLowerCase());

        return (
          <li key={citation.id} className="ds-sans">
            {citation.href ? (
              <a href={citation.href} rel="noopener noreferrer">
                {linkText}
              </a>
            ) : (
              <span>{linkText}</span>
            )}
            {showHost ? <span className="ds-mono"> ({citation.source})</span> : null}
          </li>
        );
      })}
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
  const basisGroups = groupBasisByCriterion(result.notabilityBasis);

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
        {basisGroups.length === 0 ? (
          <EmptyState title={WHY_THIS_APPEARS_COPY.basisHeading}>
            {WHY_THIS_APPEARS_COPY.noBasisRecorded}
          </EmptyState>
        ) : (
          <div className="ds-why-appears__basis" aria-label={WHY_THIS_APPEARS_COPY.basisHeading}>
            {basisGroups.map((group, groupIndex) => (
              <div key={`${group.criterion}_${groupIndex}`} className="ds-why-appears__basis-group">
                <p className="ds-mono ds-why-appears__criterion">{group.criterionLabel}</p>
                <ul className="ds-why-appears__notes">
                  {group.items.map((item, index) => (
                    <li key={`${item.criterion}_${index}`} className="ds-sans">
                      {item.note}
                    </li>
                  ))}
                </ul>
                <CitationList items={group.items} evidenceById={evidenceById} />
              </div>
            ))}
          </div>
        )}
      </section>

      {result.missingPerspectiveIndicators.length > 0 ? (
        <section aria-labelledby={coverageHeadingId} className="ds-why-appears__block ds-stack">
          <h3 id={coverageHeadingId} className="ds-subheading">
            {WHY_THIS_APPEARS_COPY.missingPerspectiveHeading}
          </h3>
          <p className="ds-sans ds-why-appears__coverage">
            {WHY_THIS_APPEARS_COPY.missingPerspectiveLead}{' '}
            {result.missingPerspectiveIndicators.map((indicator) => indicator.label).join(', ')}.
            {' '}
            {WHY_THIS_APPEARS_COPY.missingPerspectiveClose}
          </p>
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
