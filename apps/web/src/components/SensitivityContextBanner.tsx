/**
 * Shared context-banner + non-endorsement component for BB-090-flagged entities (BB-095 AC2).
 *
 * RULE: include-with-context, NEVER suppression. This component takes no prop that could hide,
 * omit, or gate the entity it accompanies — it is purely additive markup rendered ALONGSIDE an
 * entity's normal content on entity pages, map cards, and search results. A `sensitivity` flag on
 * an entity that clears notability must never cause that entity to be hidden; this component has
 * no mechanism to do so even by mistake (it renders unconditionally from its props, with no
 * "hidden"/"suppressed" branch).
 *
 * Non-goal guard: BB-090 sensitivity flags require a conduct-based rationale, never an identity
 * attribute (a historical figure's sexuality, race, disability, religion, etc. is never itself a
 * valid flag condition). This component builds no UI for CREATING or applying a sensitivity flag
 * — it only presents an already-flagged entity's existing `note` (the reviewer's conduct-based
 * rationale, authored elsewhere under BB-090) — so there is no flagging surface here that could
 * invite identity-based reasoning. See docs/security/entity-sensitivity-lanes.md.
 *
 * INTEGRATION POINT (documented, not wired live — pending `packages/domain/src/index.ts` export
 * merge; see the BB-095 handoff notes for exact statements): a real caller resolves `classLabel`
 * via `SENSITIVITY_CLASS_PRESENTATION_LABELS[sensitivity.class]` and `sensitiveContentDisclaimer`
 * / `nonEndorsementDisclaimer` via `getDisclaimer('sensitive_content')` /
 * `getDisclaimer('non_endorsement')` from `@black-book/domain`, then renders this component on
 * the entity page, map card, and search result surfaces. None of those consuming surfaces are
 * wired in this bead — apps/web's entity/map/search pages remain untouched (see the BB-095
 * handoff notes for why).
 */

import React from 'react';
import type { EntityKind, EntitySensitivity } from '@black-book/domain';
import { DisclaimerBanner, type DisclaimerCopy } from './DisclaimerBanner';
import { Notice } from '@black-book/ui';

export type SensitivityContextBannerProps = {
  readonly sensitivity: EntitySensitivity;
  /** Procedural, conduct-based label for `sensitivity.class` — see
   * `SENSITIVITY_CLASS_PRESENTATION_LABELS` in `@black-book/domain`'s disclaimers module. */
  readonly classLabel: string;
  /** `getDisclaimer('sensitive_content')` from the registry. */
  readonly sensitiveContentDisclaimer: DisclaimerCopy;
  /** `getDisclaimer('non_endorsement')` — rendered only when `entityKind === 'person'`. */
  readonly nonEndorsementDisclaimer?: DisclaimerCopy;
  readonly entityKind?: EntityKind;
};

export function SensitivityContextBanner({
  sensitivity,
  classLabel,
  sensitiveContentDisclaimer,
  nonEndorsementDisclaimer,
  entityKind,
}: SensitivityContextBannerProps) {
  const showNonEndorsement = entityKind === 'person' && Boolean(nonEndorsementDisclaimer);

  return (
    <div className="bb-stack" role="group" aria-label={`Sensitivity context: ${classLabel}`}>
      <Notice tone="warning" title={classLabel}>
        <p style={{ margin: 0 }}>{sensitivity.note}</p>
        <p style={{ margin: 0, marginTop: 'var(--bb-space-2)' }}>{sensitiveContentDisclaimer.body}</p>
      </Notice>
      {showNonEndorsement && nonEndorsementDisclaimer ? (
        <DisclaimerBanner {...nonEndorsementDisclaimer} />
      ) : null}
    </div>
  );
}
