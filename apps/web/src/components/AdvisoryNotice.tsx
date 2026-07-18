/**
 * Present-day advisory banner for place-kind entities.
 *
 * Renders a dated, cited, procedural statement ONLY "Private property as of [date], per
 * [source]." "Dangerous today" never appears here as copy, a badge, or a classification: this
 * component has no "danger level" prop, no red/danger styling hook, and no urgency framing. It
 * renders through the same muted `Notice tone="warning"` treatment as every other site notice
 * (`SeedDataNotice`, `OfflineNotice`, `DisclaimerBanner`) never a distinct "danger" tone (the
 * shared `Notice` component doesn't define one).
 *
 * Advisory data is presentation-only BY CONSTRUCTION AND BY TEST: `packages/domain/src/advisory.ts`
 * exposes no function that feeds an advisory field into any scoring/composite pipeline, and
 * `advisory.test.ts` proves the real relevance/confidence composites never carry one. This
 * component only ever receives the already-built `statement` string (from
 * `buildAdvisoryStatement`) it has no access to raw scoring internals to leak in the first
 * place.
 *
 * Callers build `statement` via `buildAdvisoryStatement(record, sourceLabel)` and
 * `safetyAdvisoryDisclaimer` via `getDisclaimer('safety_advisory')`, both from
 * `@repo/domain`, then render this component on a place entity's page and its map card.
 */

import React from 'react';
import { DisclaimerBanner, type DisclaimerCopy } from './DisclaimerBanner';
import { Notice } from '@repo/ui';

export type AdvisoryNoticeProps = {
  /** Procedural class label, e.g. `ADVISORY_CLASS_LABELS[advisoryClass]` from `@repo/domain`'s advisory module.  */
  readonly classLabel: string;
  /** The single dated, cited, procedural sentence `buildAdvisoryStatement(...)`'s output.  */
  readonly statement: string;
  readonly reviewCadence: string;
  /** `getDisclaimer('safety_advisory')` from the registry.  */
  readonly safetyAdvisoryDisclaimer: DisclaimerCopy;
};

export function AdvisoryNotice({
  classLabel,
  statement,
  reviewCadence,
  safetyAdvisoryDisclaimer,
}: AdvisoryNoticeProps) {
  return (
    <div className="ds-stack" role="group" aria-label={`Present-day advisory: ${classLabel}`}>
      <Notice tone="warning" title={classLabel}>
        <p style={{ margin: 0 }}>{statement}</p>
        <p className="ds-mono" style={{ margin: 0, marginTop: 'var(--ds-space-2)' }}>
          Review cadence: {reviewCadence}.
        </p>
      </Notice>
      <DisclaimerBanner {...safetyAdvisoryDisclaimer} />
    </div>
  );
}
