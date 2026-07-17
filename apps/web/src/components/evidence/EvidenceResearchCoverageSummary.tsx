/**
 * Record-level BB-053 summary: research coverage, total source lineage count across every
 * evidenced claim, the most recent last-checked date, and any record-level retraction or
 * correction notices that apply beyond a single claim. Kept as its own `Card` so this rollup
 * reads as a distinct fact from any individual claim's confidence (acceptance criterion 2).
 */

import React from 'react';
import { Card, Notice } from '@black-book/ui';
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
    <Card title="Research coverage" meta={<span className="bb-mono">{humanizeToken(researchCoverage.level)}</span>} as="section">
      <dl className="bb-sans" style={{ margin: 0 }}>
        {sourceLineage ? (
          <>
            <dt style={{ fontWeight: 600 }}>Source lineage</dt>
            <dd style={{ margin: '0 0 var(--bb-space-3) 0' }}>
              <span className="bb-mono">{sourceLineage.independentLineageCount}</span> independent{' '}
              {sourceLineage.independentLineageCount === 1 ? 'source' : 'sources'} across this record&rsquo;s
              evidenced claims.
            </dd>
          </>
        ) : null}
        {researchCoverage.notes ? (
          <>
            <dt style={{ fontWeight: 600 }}>Coverage notes</dt>
            <dd style={{ margin: '0 0 var(--bb-space-3) 0' }}>{researchCoverage.notes}</dd>
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
        <div className="bb-stack" style={{ marginTop: 'var(--bb-space-4)' }}>
          {retractionNotices.map((notice) => (
            <Notice
              key={notice.retractedAt}
              tone="error"
              title={`Retracted ${formatIsoDate(notice.retractedAt)}`}
            >
              <p style={{ margin: 0 }}>{notice.reason}</p>
              {notice.supersededByClaimId ? (
                <p style={{ margin: 'var(--bb-space-2) 0 0 0' }}>
                  Superseded by <span className="bb-mono">{notice.supersededByClaimId}</span>.
                </p>
              ) : null}
            </Notice>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
