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
 * here; see `buildEvidenceCard` for that.
 */

import React from 'react';
import { Card, Citation, Confidence, Notice } from '@repo/ui';
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
    <Card id={card.id} title={predicateLabel} aria-describedby={citationId}>
      <p className="ds-evidence-claim__body">{card.object}</p>

      <div className="ds-row" style={{ marginBottom: 'var(--ds-space-3)', flexWrap: 'wrap' }}>
        <Confidence level={card.confidenceLevel} label={card.confidenceLabel} />
      </div>

      {(card.relevanceNote || card.connectionStrengthNote) && (
        <dl className="ds-sans" style={{ margin: '0 0 var(--ds-space-3) 0' }}>
          {card.relevanceNote ? (
            <>
              <dt style={{ fontWeight: 600 }}>Relevance</dt>
              <dd style={{ margin: '0 0 var(--ds-space-2) 0' }}>{card.relevanceNote}</dd>
            </>
          ) : null}
          {card.connectionStrengthNote ? (
            <>
              <dt style={{ fontWeight: 600 }}>Connection strength</dt>
              <dd style={{ margin: 0 }}>{card.connectionStrengthNote}</dd>
            </>
          ) : null}
        </dl>
      )}

      <div id={citationId}>
        <Citation
          source={card.citation.source}
          label={card.citation.label}
          {...(card.citation.href ? { href: card.citation.href } : {})}
        />
        {card.citation.withheldReason ? (
          <p
            className="ds-sans"
            style={{ margin: 'var(--ds-space-2) 0 0 0', color: 'var(--ds-ink-muted)' }}
          >
            {card.citation.withheldReason}
          </p>
        ) : null}
      </div>

      {card.excerpt ? (
        card.excerpt.visible ? (
          <blockquote
            className="ds-sans"
            cite={card.citation.href}
            style={{
              margin: 'var(--ds-space-3) 0 0 0',
              paddingLeft: 'var(--ds-space-4)',
              borderLeft: '2px solid var(--ds-border)',
            }}
          >
            {card.excerpt.text}
          </blockquote>
        ) : (
          <p
            className="ds-sans"
            style={{ margin: 'var(--ds-space-3) 0 0 0', color: 'var(--ds-ink-muted)' }}
          >
            {card.excerpt.reason}
          </p>
        )
      ) : null}

      {card.dispute?.hasDispute ? (
        <div style={{ marginTop: 'var(--ds-space-3)' }}>
          <Notice tone="dispute" title="Preserved contradiction">
            {card.dispute.note ? (
              <p style={{ margin: '0 0 var(--ds-space-2) 0' }}>{card.dispute.note}</p>
            ) : null}
            {card.dispute.alternates.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 'var(--ds-space-5)' }}>
                {card.dispute.alternates.map((alternate) => (
                  <li key={`${card.id}_${alternate.value}`}>
                    <span className="ds-mono">{alternate.value}</span>
                    {' \u2014 '}
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
        <p
          className="ds-sans"
          style={{ margin: 'var(--ds-space-3) 0 0 0', color: 'var(--ds-ink-muted)' }}
        >
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
        <details style={{ marginTop: 'var(--ds-space-3)' }}>
          <summary className="ds-sans" style={{ fontWeight: 600, cursor: 'pointer' }}>
            Revision history ({card.revisionHistory.length})
          </summary>
          <ol
            className="ds-sans"
            style={{ margin: 'var(--ds-space-2) 0 0 0', paddingLeft: 'var(--ds-space-5)' }}
          >
            {card.revisionHistory.map((entry) => (
              <li key={entry.id}>
                <span className="ds-mono">{humanizeToken(entry.changeKind)}</span>
                {' \u2014 '}
                {entry.summary} ({formatIsoDate(entry.changedAt)})
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {card.retraction ? (
        <div style={{ marginTop: 'var(--ds-space-3)' }}>
          <Notice tone="error" title={`Retracted ${formatIsoDate(card.retraction.retractedAt)}`}>
            <p style={{ margin: 0 }}>{card.retraction.reason}</p>
            {card.retraction.supersededByClaimId ? (
              <p style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
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
