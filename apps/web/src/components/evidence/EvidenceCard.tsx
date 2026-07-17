/**
 * Renders one BB-053 evidence card for a claim: an evidence-score confidence badge (never
 * probability language unless calibrated — acceptance criterion 1), a claim<->citation aria
 * association matching the entity page's existing claims-section pattern, a rights-limited
 * excerpt (or an explicit withheld notice — acceptance criterion 4), a preserved
 * contradiction/dispute notice when one exists (acceptance criterion 3), source-lineage /
 * research-coverage / last-checked metadata kept visually and structurally distinct from the
 * confidence badge (acceptance criterion 2), a collapsible revision history, and a retraction
 * notice when the claim has been retracted or corrected.
 *
 * Pure presentation over `../../lib/evidence`'s `EvidenceClaimView` — no derivation logic lives
 * here; see `buildEvidenceCard` for that.
 */

import React from 'react';
import { Card, Citation, Confidence, Notice } from '@black-book/ui';
import { formatIsoDate, humanizeToken, type EvidenceClaimView } from '../../lib/evidence';

export type EvidenceCardProps = {
  readonly card: EvidenceClaimView;
};

export function EvidenceCard({ card }: EvidenceCardProps) {
  const citationId = `${card.id}-evidence-citation`;
  const hasCoverageMeta = Boolean(card.sourceLineage || card.researchCoverage || card.lastCheckedAt);
  const lastChecked = card.lastCheckedAt ?? card.researchCoverage?.lastCheckedAt;

  return (
    <Card
      id={card.id}
      title={`${humanizeToken(card.predicate)}: ${card.object}`}
      meta={<span className="bb-mono">{card.id}</span>}
      aria-describedby={citationId}
    >
      <div className="bb-row" style={{ marginBottom: 'var(--bb-space-3)', flexWrap: 'wrap' }}>
        <Confidence level={card.confidenceLevel} label={card.confidenceLabel} />
      </div>

      {(card.relevanceNote || card.connectionStrengthNote) && (
        <dl className="bb-sans" style={{ margin: '0 0 var(--bb-space-3) 0' }}>
          {card.relevanceNote ? (
            <>
              <dt style={{ fontWeight: 600 }}>Relevance</dt>
              <dd style={{ margin: '0 0 var(--bb-space-2) 0' }}>{card.relevanceNote}</dd>
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
          <p className="bb-sans" style={{ margin: 'var(--bb-space-2) 0 0 0', color: 'var(--bb-ink-muted)' }}>
            {card.citation.withheldReason}
          </p>
        ) : null}
      </div>

      {card.excerpt ? (
        card.excerpt.visible ? (
          <blockquote
            className="bb-sans"
            cite={card.citation.href}
            style={{
              margin: 'var(--bb-space-3) 0 0 0',
              paddingLeft: 'var(--bb-space-4)',
              borderLeft: '2px solid var(--bb-border)',
            }}
          >
            {card.excerpt.text}
          </blockquote>
        ) : (
          <p className="bb-sans" style={{ margin: 'var(--bb-space-3) 0 0 0', color: 'var(--bb-ink-muted)' }}>
            {card.excerpt.reason}
          </p>
        )
      ) : null}

      {card.dispute?.hasDispute ? (
        <div style={{ marginTop: 'var(--bb-space-3)' }}>
          <Notice tone="dispute" title="Preserved contradiction">
            {card.dispute.note ? <p style={{ margin: '0 0 var(--bb-space-2) 0' }}>{card.dispute.note}</p> : null}
            {card.dispute.alternates.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 'var(--bb-space-5)' }}>
                {card.dispute.alternates.map((alternate) => (
                  <li key={`${card.id}_${alternate.value}`}>
                    <span className="bb-mono">{alternate.value}</span>{' \u2014 '}
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
        <p className="bb-sans" style={{ margin: 'var(--bb-space-3) 0 0 0', color: 'var(--bb-ink-muted)' }}>
          {card.sourceLineage ? (
            <>
              Source lineage: <span className="bb-mono">{card.sourceLineage.independentLineageCount}</span>{' '}
              independent {card.sourceLineage.independentLineageCount === 1 ? 'source' : 'sources'}.{' '}
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
        <details style={{ marginTop: 'var(--bb-space-3)' }}>
          <summary className="bb-sans" style={{ fontWeight: 600, cursor: 'pointer' }}>
            Revision history ({card.revisionHistory.length})
          </summary>
          <ol className="bb-sans" style={{ margin: 'var(--bb-space-2) 0 0 0', paddingLeft: 'var(--bb-space-5)' }}>
            {card.revisionHistory.map((entry) => (
              <li key={entry.id}>
                <span className="bb-mono">{humanizeToken(entry.changeKind)}</span>
                {' \u2014 '}
                {entry.summary} ({formatIsoDate(entry.changedAt)})
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {card.retraction ? (
        <div style={{ marginTop: 'var(--bb-space-3)' }}>
          <Notice tone="error" title={`Retracted ${formatIsoDate(card.retraction.retractedAt)}`}>
            <p style={{ margin: 0 }}>{card.retraction.reason}</p>
            {card.retraction.supersededByClaimId ? (
              <p style={{ margin: 'var(--bb-space-2) 0 0 0' }}>
                Superseded by <span className="bb-mono">{card.retraction.supersededByClaimId}</span>.
              </p>
            ) : null}
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}
