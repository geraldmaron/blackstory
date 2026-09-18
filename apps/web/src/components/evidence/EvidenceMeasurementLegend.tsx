/**
 * Collapsible measurement-dimension legend so a reader can tell confidence, relevance,
 * connection strength, and research coverage apart rather than treating them as one blended
 * trust figure. Copy is centralized in `../../lib/evidence/confidence-language.ts`'s
 * `EVIDENCE_DIMENSION_COPY`, never hand-typed here. Renders as `<details>` so claims lead
 * and pedagogy stays available without competing Card chrome.
 */

import React from 'react';
import Link from 'next/link';
import { EVIDENCE_DIMENSION_COPY } from '../../lib/evidence';
import {
  METHODOLOGY_EVIDENCE_GRADES_HREF,
  METHODOLOGY_HOW_RECORD_GETS_IN_HREF,
} from './editorial-links';

export function EvidenceMeasurementLegend() {
  return (
    <details className="ds-evidence-legend">
      <summary className="ds-evidence-legend__summary">
        How to read this record&rsquo;s measurements
      </summary>
      <dl className="ds-sans ds-evidence-legend__body">
        {Object.values(EVIDENCE_DIMENSION_COPY).map((entry) => (
          <React.Fragment key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.description}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="ds-evidence-legend__offramp ds-sans">
        <Link href={METHODOLOGY_EVIDENCE_GRADES_HREF} prefetch={false}>
          Evidence grade definitions
        </Link>
        {' · '}
        <Link href={METHODOLOGY_HOW_RECORD_GETS_IN_HREF} prefetch={false}>
          How a record gets in
        </Link>
      </p>
    </details>
  );
}
