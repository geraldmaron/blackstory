/**
 * Shared context-banner + non-endorsement component for sensitivity-flagged entities.
 *
 * RULE: include-with-context, NEVER suppression. This component takes no prop that could hide,
 * omit, or gate the entity it accompanies — it is purely additive markup rendered ALONGSIDE an
 * entity's normal content on entity pages, map cards, and search results. A `sensitivity` flag on
 * an entity that clears notability must never cause that entity to be hidden; this component has
 * no mechanism to do so even by mistake (it renders unconditionally from its props, with no
 * "hidden"/"suppressed" branch).
 *
 * Non-goal guard: sensitivity flags require a conduct-based rationale, never an identity
 * attribute (a historical figure's sexuality, race, disability, religion, etc. is never itself a
 * valid flag condition). This component builds no UI for CREATING or applying a sensitivity flag;
 * it only presents an already-flagged entity's existing `note` (the reviewer's conduct-based
 * rationale, authored elsewhere) so there is no flagging surface here that could invite
 * identity-based reasoning. See docs/security/entity-sensitivity-lanes.md.
 *
 * Callers resolve `classLabel` via `SENSITIVITY_CLASS_PRESENTATION_LABELS[sensitivity.class]`
 * and disclaimer copy via `getDisclaimer('sensitive_content')` /
 * `getDisclaimer('non_endorsement')` from `@repo/domain`, then render this component on
 * the entity page, map card, and search result surfaces.
 */

import React from 'react';
import type { EntityKind } from '@repo/domain/entity-kinds';
import type { EntitySensitivity } from '@repo/domain/entity-status';
import { DisclaimerBanner, type DisclaimerCopy } from './DisclaimerBanner';
import { Notice } from '@repo/ui';

export type SensitivityContextBannerProps = {
  readonly sensitivity: EntitySensitivity;
  /** Procedural, conduct-based label for `sensitivity.class` see
   * `SENSITIVITY_CLASS_PRESENTATION_LABELS` in `@repo/domain`'s disclaimers module. */
  readonly classLabel: string;
  /** `getDisclaimer('sensitive_content')` from the registry.  */
  readonly sensitiveContentDisclaimer: DisclaimerCopy;
  /** `getDisclaimer('non_endorsement')` rendered only when `entityKind === 'person'`.  */
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
    <div className="ds-stack" role="group" aria-label={`Sensitivity context: ${classLabel}`}>
      <Notice tone="warning" title={classLabel}>
        <p style={{ margin: 0 }}>{sensitivity.note}</p>
        <p style={{ margin: 0, marginTop: 'var(--ds-space-2)' }}>{sensitiveContentDisclaimer.body}</p>
      </Notice>
      {showNonEndorsement && nonEndorsementDisclaimer ? (
        <DisclaimerBanner {...nonEndorsementDisclaimer} />
      ) : null}
    </div>
  );
}
