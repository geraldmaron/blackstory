/**
 * Renders one evidence card for a claim: an evidence-score confidence badge (never
 * probability language unless calibrated), a claim↔citation aria association matching the
 * entity page's existing claims-section pattern, a rights-limited excerpt (or an explicit
 * withheld notice), a preserved contradiction/dispute notice when one exists, source-lineage /
 * research-coverage / last-checked metadata kept visually and structurally distinct from the
 * confidence badge, a collapsible revision history, and a retraction notice when the claim has
 * been retracted or corrected.
 *
 * Pure presentation over `../../lib/evidence`'s `EvidenceClaimView` — no derivation logic lives
 * here; see `buildEvidenceCard` for that. Layout is class-driven (`entity-page.css`'s
 * `.ds-evidence-claim__*`) so the record page can set the claim register once.
 */

import React from 'react';
import { Card, Citation, Confidence, Notice } from '@repo/ui';
import { sanitizePublicProseText } from '@repo/domain/editorial';
import { formatIsoDate, humanizeToken, type EvidenceClaimView } from '../../lib/evidence';

export type EvidenceCardProps = {
  readonly card: EvidenceClaimView;
};

export function EvidenceCard({ card }: EvidenceCardProps) {
  const citationId = `${card.id}-evidence-citation`;
  const hasCoverageMeta = Boolean(
    card.sourceLineage || card.researchCoverage || card.lastCheckedAt,
  );
  const lastChecked = card.lastCheckedAt ?? card.researchCoverage?.lastCheckedAt;
  const predicateLabel = humanizeToken(card.predicate);

  return (
    <Card
      id={card.id}
      title={predicateLabel}
      className={`ds-evidence-claim ds-evidence-claim--${card.confidenceLevel}`}
      aria-describedby={citationId}
    >
      <p className="ds-evidence-claim__body">{sanitizePublicProseText(card.object)}</p>

      <div className="ds-row ds-evidence-claim__meta">
        <Confidence level={card.confidenceLevel} label={card.confidenceLabel} />
      </div>

      {(card.relevanceNote || card.connectionStrengthNote) && (
        <dl className="ds-sans ds-evidence-claim__notes">
          {card.relevanceNote ? (
            <>
              <dt>Relevance</dt>
              <dd>{card.relevanceNote}</dd>
            </>
          ) : null}
          {card.connectionStrengthNote ? (
            <>
              <dt>Connection strength</dt>
              <dd>{card.connectionStrengthNote}</dd>
            </>
          ) : null}
        </dl>
      )}

      <div id={citationId} className="ds-evidence-claim__source">
        <Citation
          source={card.citation.source}
          label={card.citation.label}
          {...(card.citation.href ? { href: card.citation.href } : {})}
        />
        {card.citation.withheldReason ? (
          <p className="ds-sans ds-evidence-claim__withheld">{card.citation.withheldReason}</p>
        ) : null}
      </div>

      {card.excerpt ? (
        card.excerpt.visible ? (
          <blockquote className="ds-sans ds-evidence-claim__excerpt" cite={card.citation.href}>
            {card.excerpt.text}
          </blockquote>
        ) : (
          <p className="ds-sans ds-evidence-claim__withheld">{card.excerpt.reason}</p>
        )
      ) : null}

      {card.dispute?.hasDispute ? (
        <div className="ds-evidence-claim__notice">
          <Notice tone="dispute" title="Preserved contradiction">
            {card.dispute.note ? (
              <p className="ds-evidence-claim__notice-lede">{card.dispute.note}</p>
            ) : null}
            {card.dispute.alternates.length > 0 ? (
              <ul className="ds-evidence-claim__alternates">
                {card.dispute.alternates.map((alternate) => (
                  <li key={`${card.id}_${alternate.value}`}>
                    <span className="ds-mono">{alternate.value}</span>
                    {' — '}
                    {humanizeToken(alternate.kind)}
                    {alternate.credible ? '' : ' (not independently credible)'}
                  </li>
                ))}
              </ul>
            ) : null}
          </Notice>
        </div>
      ) : null}

      {hasCoverageMeta ? (
        <p className="ds-sans ds-evidence-claim__coverage">
          {card.sourceLineage ? (
            <>
              Source lineage:{' '}
              <span className="ds-mono">{card.sourceLineage.independentLineageCount}</span>{' '}
              independent {card.sourceLineage.independentLineageCount === 1 ? 'source' : 'sources'}
              .{' '}
            </>
          ) : null}
          {card.researchCoverage ? (
            <>
              Research coverage: <strong>{humanizeToken(card.researchCoverage.level)}</strong>.{' '}
            </>
          ) : null}
          {lastChecked ? <>Last checked {formatIsoDate(lastChecked)}.</> : null}
        </p>
      ) : null}

      {card.revisionHistory.length > 0 ? (
        <details className="ds-evidence-claim__history">
          <summary className="ds-sans ds-evidence-claim__history-summary">
            Revision history ({card.revisionHistory.length})
          </summary>
          <ol className="ds-sans ds-evidence-claim__history-list">
            {card.revisionHistory.map((entry) => (
              <li key={entry.id}>
                <span className="ds-mono">{humanizeToken(entry.changeKind)}</span>
                {' — '}
                {entry.summary} ({formatIsoDate(entry.changedAt)})
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {card.retraction ? (
        <div className="ds-evidence-claim__notice">
          <Notice tone="error" title={`Retracted ${formatIsoDate(card.retraction.retractedAt)}`}>
            <p className="ds-evidence-claim__notice-lede">{card.retraction.reason}</p>
            {card.retraction.supersededByClaimId ? (
              <p className="ds-evidence-claim__notice-more">
                Superseded by <span className="ds-mono">{card.retraction.supersededByClaimId}</span>
                .
              </p>
            ) : null}
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}
