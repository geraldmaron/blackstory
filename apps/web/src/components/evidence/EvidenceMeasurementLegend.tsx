/**
 * Renders the measurement-dimension legend so a reader can tell confidence, relevance,
 * connection strength, and research coverage apart rather than treating them as one blended
 * trust figure. Copy is centralized in `../../lib/evidence/confidence-language.ts`'s
 * `EVIDENCE_DIMENSION_COPY`, never hand-typed here.
 */

import React from 'react';
import { Card } from '@black-book/ui';
import { EVIDENCE_DIMENSION_COPY } from '../../lib/evidence';

export function EvidenceMeasurementLegend() {
  return (
    <Card title="How to read this record's measurements" as="section">
      <dl className="bb-sans" style={{ margin: 0 }}>
        {Object.values(EVIDENCE_DIMENSION_COPY).map((entry) => (
          <React.Fragment key={entry.label}>
            <dt style={{ fontWeight: 600 }}>{entry.label}</dt>
            <dd style={{ margin: '0 0 var(--bb-space-3) 0' }}>{entry.description}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Card>
  );
}
