/**
 * Record-level summary: research coverage, total source lineage count across every
 * evidenced claim, the most recent last-checked date, and any record-level retraction or
 * correction notices that apply beyond a single claim. Kept as its own `Card` so this rollup
 * reads as a distinct fact from any individual claim's confidence.
 */

import React from 'react';
import { Card, Notice } from '@repo/ui';
import {
  formatIsoDate,
  humanizeToken,
  type EvidenceResearchCoverageInput,
  type EvidenceRetractionNotice,
  type EvidenceSourceLineageInput,
} from '../../lib/evidence';

export type EvidenceResearchCoverageSummaryProps = {
  readonly researchCoverage: EvidenceResearchCoverageInput;
  readonly sourceLineage?: EvidenceSourceLineageInput;
  readonly lastCheckedAt?: string;
  readonly retractionNotices?: readonly EvidenceRetractionNotice[];
};

export function EvidenceResearchCoverageSummary({
  researchCoverage,
  sourceLineage,
  lastCheckedAt,
  retractionNotices = [],
}: EvidenceResearchCoverageSummaryProps) {
  const lastChecked = lastCheckedAt ?? researchCoverage.lastCheckedAt;

  return (
    <Card title="Research coverage" meta={<span className="ds-mono">{humanizeToken(researchCoverage.level)}</span>} as="section">
      <dl className="ds-sans" style={{ margin: 0 }}>
        {sourceLineage ? (
          <>
            <dt style={{ fontWeight: 600 }}>Source lineage</dt>
            <dd style={{ margin: '0 0 var(--ds-space-3) 0' }}>
              <span className="ds-mono">{sourceLineage.independentLineageCount}</span> independent{' '}
              {sourceLineage.independentLineageCount === 1 ? 'source' : 'sources'} across this record&rsquo;s
              evidenced claims.
            </dd>
          </>
        ) : null}
        {researchCoverage.notes ? (
          <>
            <dt style={{ fontWeight: 600 }}>Coverage notes</dt>
            <dd style={{ margin: '0 0 var(--ds-space-3) 0' }}>{researchCoverage.notes}</dd>
          </>
        ) : null}
        {lastChecked ? (
          <>
            <dt style={{ fontWeight: 600 }}>Last checked</dt>
            <dd style={{ margin: 0 }}>{formatIsoDate(lastChecked)}</dd>
          </>
        ) : null}
      </dl>

      {retractionNotices.length > 0 ? (
        <div className="ds-stack" style={{ marginTop: 'var(--ds-space-4)' }}>
          {retractionNotices.map((notice) => (
            <Notice
              key={notice.retractedAt}
              tone="error"
              title={`Retracted ${formatIsoDate(notice.retractedAt)}`}
            >
              <p style={{ margin: 0 }}>{notice.reason}</p>
              {notice.supersededByClaimId ? (
                <p style={{ margin: 'var(--ds-space-2) 0 0 0' }}>
                  Superseded by <span className="ds-mono">{notice.supersededByClaimId}</span>.
                </p>
              ) : null}
            </Notice>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
