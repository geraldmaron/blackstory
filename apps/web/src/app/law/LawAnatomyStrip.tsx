/**
 * Compact law entry fact strip for detail intro panels. EditionFactIcon labels
 * pair with visible mono text so icons are never the only signal (WCAG 1.4.1).
 */
import React from 'react';
import type { LawStatus } from '@repo/domain/entity-status';
import type { ConfidenceTierKey } from '../../lib/map-experience/confidence-icons';
import { EditionFactIcon } from '../../components/patterns/EditionFactIcon';
import { LegalStatusBadge } from '../../components/legal/LegalStatusBadge';
import { humanizeLegalKind } from '../../components/legal/format';
import '../../components/patterns/edition-fact-icon.css';

export type LawAnatomyStripProps = {
  readonly kind: string;
  readonly lawStatus: LawStatus;
  readonly jurisdictionId: string;
  readonly citation: string;
  readonly topics: readonly string[];
};

function evidenceTierForStatus(status: LawStatus): ConfidenceTierKey {
  switch (status) {
    case 'in_force':
      return 'high';
    case 'amended':
      return 'medium';
    case 'enjoined':
      return 'low';
    case 'repealed':
    case 'struck_down':
      return 'unrated';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function LawAnatomyStrip({
  kind,
  lawStatus,
  jurisdictionId,
  citation,
  topics,
}: LawAnatomyStripProps) {
  const topicLine =
    topics.length > 0 ? topics.slice(0, 3).join(' · ') : 'Topic not yet tagged';

  return (
    <section className="ds-law-anatomy" aria-label="Law entry at a glance">
      <dl className="ds-law-anatomy__facts">
        <div className="ds-law-anatomy__fact">
          <dt className="ds-law-anatomy__fact-label">
            <EditionFactIcon variant="entry" step="source" />
            Kind
          </dt>
          <dd className="ds-law-anatomy__fact-value">{humanizeLegalKind(kind)}</dd>
        </div>
        <div className="ds-law-anatomy__fact">
          <dt className="ds-law-anatomy__fact-label">
            <EditionFactIcon variant="record-evidence" tier={evidenceTierForStatus(lawStatus)} />
            Status
          </dt>
          <dd className="ds-law-anatomy__fact-value">
            <LegalStatusBadge status={lawStatus} />
          </dd>
        </div>
        <div className="ds-law-anatomy__fact">
          <dt className="ds-law-anatomy__fact-label">
            <EditionFactIcon variant="record-where" />
            Jurisdiction
          </dt>
          <dd className="ds-law-anatomy__fact-value">
            <span className="ds-mono">{jurisdictionId}</span>
          </dd>
        </div>
        <div className="ds-law-anatomy__fact">
          <dt className="ds-law-anatomy__fact-label">
            <EditionFactIcon variant="entry" step="source" />
            Citation
          </dt>
          <dd className="ds-law-anatomy__fact-value">
            <span className="ds-mono">{citation}</span>
          </dd>
        </div>
        <div className="ds-law-anatomy__fact ds-law-anatomy__fact--wide">
          <dt className="ds-law-anatomy__fact-label">
            <EditionFactIcon variant="record-era" />
            Topics
          </dt>
          <dd className="ds-law-anatomy__fact-value">{topicLine}</dd>
        </div>
      </dl>
    </section>
  );
}
