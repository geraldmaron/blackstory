/**
 * Sensitivity context banner. `entity.sensitivity` is one of the fields `entity.ts`'s own
 * header comment says must be "Kept VISIBLE" — this is additive context, never a suppression
 * of the record, matching web's `EntitySensitivityBanner`/`SensitivityContextBanner` intent.
 * Renders through `@/ui`'s `Notice` (tone="warning") rather than a bespoke banner component.
 */
import { Notice } from '@/ui';
import { humanizeToken } from '../format';
import type { EntitySensitivity } from '../types';

export type SensitivityBannerProps = {
  readonly sensitivity: EntitySensitivity;
};

export function SensitivityBanner({ sensitivity }: SensitivityBannerProps) {
  return (
    <Notice
      tone="warning"
      title={`Context: ${humanizeToken(sensitivity.class)}`}
      description={sensitivity.note}
    />
  );
}
