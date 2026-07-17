/**
 * Present-day advisory banner for place-kind entities (BB-095 AC1/AC4).
 *
 * Renders a dated, cited, procedural statement ONLY — "Private property as of [date], per
 * [source]." "Dangerous today" never appears here as copy, a badge, or a classification: this
 * component has no "danger level" prop, no red/danger styling hook, and no urgency framing. It
 * renders through the same muted `Notice tone="warning"` treatment as every other site notice
 * (`SeedDataNotice`, `OfflineNotice`, `DisclaimerBanner`) — never a distinct "danger" tone (the
 * shared `Notice` component doesn't define one).
 *
 * Advisory data is presentation-only BY CONSTRUCTION AND BY TEST: `packages/domain/src/advisory.ts`
 * exposes no function that feeds an advisory field into any scoring/composite pipeline, and
 * `advisory.test.ts` proves the real relevance/confidence composites never carry one. This
 * component only ever receives the already-built `statement` string (from
 * `buildAdvisoryStatement`) — it has no access to raw scoring internals to leak in the first
 * place.
 *
 * INTEGRATION POINT (documented, not wired live — pending `packages/domain/src/index.ts` export
 * merge; see the BB-095 handoff notes for exact statements): a real caller builds `statement` via
 * `buildAdvisoryStatement(record, sourceLabel)` and `safetyAdvisoryDisclaimer` via
 * `getDisclaimer('safety_advisory')`, both from `@black-book/domain`, then renders this component
 * on a place entity's page and its map card. Not wired into apps/web/src/app/entity or
 * apps/web/src/app/map in this bead — see the BB-095 handoff notes for why.
 */

import React from 'react';
import { DisclaimerBanner, type DisclaimerCopy } from './DisclaimerBanner';
import { Notice } from '@black-book/ui';

export type AdvisoryNoticeProps = {
  /** Procedural class label, e.g. `ADVISORY_CLASS_LABELS[advisoryClass]` from `@black-book/domain`'s advisory module. */
  readonly classLabel: string;
  /** The single dated, cited, procedural sentence — `buildAdvisoryStatement(...)`'s output. */
  readonly statement: string;
  readonly reviewCadence: string;
  /** `getDisclaimer('safety_advisory')` from the registry. */
  readonly safetyAdvisoryDisclaimer: DisclaimerCopy;
};

export function AdvisoryNotice({
  classLabel,
  statement,
  reviewCadence,
  safetyAdvisoryDisclaimer,
}: AdvisoryNoticeProps) {
  return (
    <div className="bb-stack" role="group" aria-label={`Present-day advisory: ${classLabel}`}>
      <Notice tone="warning" title={classLabel}>
        <p style={{ margin: 0 }}>{statement}</p>
        <p className="bb-mono" style={{ margin: 0, marginTop: 'var(--bb-space-2)' }}>
          Review cadence: {reviewCadence}.
        </p>
      </Notice>
      <DisclaimerBanner {...safetyAdvisoryDisclaimer} />
    </div>
  );
}
