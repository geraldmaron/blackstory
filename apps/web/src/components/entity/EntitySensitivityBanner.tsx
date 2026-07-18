/**
 * Wires a `EntitySensitivity` record into the `SensitivityContextBanner` component
 * contract resolving the conduct-based class label and the sensitive-content non-endorsement
 * disclaimer copy from `@blap/domain`'s versioned registry, exactly as that component's own
 * "real caller" integration-point doc describes. Renders unconditionally additive markup
 * alongside the entity's normal content (include-with-context, never suppression) per.
 */

import React from 'react';
import {
  getDisclaimer,
  SENSITIVITY_CLASS_PRESENTATION_LABELS,
  type EntityKind,
  type EntitySensitivity,
} from '@blap/domain';
import { SensitivityContextBanner } from '../SensitivityContextBanner';

export type EntitySensitivityBannerProps = {
  readonly sensitivity: EntitySensitivity;
  readonly entityKind: EntityKind;
};

export function EntitySensitivityBanner({ sensitivity, entityKind }: EntitySensitivityBannerProps) {
  return (
    <SensitivityContextBanner
      sensitivity={sensitivity}
      classLabel={SENSITIVITY_CLASS_PRESENTATION_LABELS[sensitivity.class]}
      sensitiveContentDisclaimer={getDisclaimer('sensitive_content')}
      nonEndorsementDisclaimer={getDisclaimer('non_endorsement')}
      entityKind={entityKind}
    />
  );
}
