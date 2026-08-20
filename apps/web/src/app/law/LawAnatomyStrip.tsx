/**
 * Compact law entry fact strip for the detail header. Built on the shared room kit's
 * `Anatomy` block (the same 2-up fact grid every record page uses) rather than a
 * route-owned panel. EditionFactIcon labels pair with visible mono text so icons are
 * never the only signal (WCAG 1.4.1).
 */
import React from 'react';
import type { LawStatus } from '@repo/domain/entity-status';
import type { ConfidenceTierKey } from '../../lib/map-experience/confidence-icons';
import { EditionFactIcon } from '../../components/patterns/EditionFactIcon';
import { LegalStatusBadge } from '../../components/legal/LegalStatusBadge';
import { humanizeLegalKind } from '../../components/legal/format';
import { Anatomy } from '../../components/room';
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
  const topicLine = topics.length > 0 ? topics.slice(0, 3).join(' · ') : 'Topic not yet tagged';

  return (
    <Anatomy
      label="Law entry at a glance"
      cells={[
        {
          label: 'Kind',
          icon: <EditionFactIcon variant="entry" step="source" />,
          value: humanizeLegalKind(kind),
        },
        {
          label: 'Status',
          icon: (
            <EditionFactIcon variant="record-evidence" tier={evidenceTierForStatus(lawStatus)} />
          ),
          value: <LegalStatusBadge status={lawStatus} />,
        },
        {
          label: 'Jurisdiction',
          icon: <EditionFactIcon variant="record-where" />,
          value: <span className="ds-mono">{jurisdictionId}</span>,
        },
        {
          label: 'Citation',
          icon: <EditionFactIcon variant="entry" step="source" />,
          value: <span className="ds-mono">{citation}</span>,
        },
        {
          label: 'Topics',
          icon: <EditionFactIcon variant="record-era" />,
          value: topicLine,
        },
      ]}
    />
  );
}
