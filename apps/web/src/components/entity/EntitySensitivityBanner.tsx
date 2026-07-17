/**
 * Wires a BB-090 `EntitySensitivity` record into the BB-095 `SensitivityContextBanner` component
 * contract — resolving the conduct-based class label and the sensitive-content / non-endorsement
 * disclaimer copy from `@black-book/domain`'s versioned registry, exactly as that component's own
 * "real caller" integration-point doc describes. Renders unconditionally additive markup
 * alongside the entity's normal content (include-with-context, never suppression) per BB-095.
 */

import React from 'react';
import {
  getDisclaimer,
  SENSITIVITY_CLASS_PRESENTATION_LABELS,
  type EntityKind,
  type EntitySensitivity,
} from '@black-book/domain';
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
