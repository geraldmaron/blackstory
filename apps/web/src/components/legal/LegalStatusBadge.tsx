/**
 * Law status badge using `LawStatus` vocabulary.
 */
import React from 'react';
import { type LawStatus } from '@repo/domain/entity-status';
import { lawStatusTone, legalStatusDisplay } from './format';

export type LegalStatusBadgeProps = {
  readonly status: LawStatus;
};

const TONE_CLASS: Readonly<Record<string, string>> = {
  neutral: 'ds-badge',
  info: 'ds-badge ds-badge--info',
  warning: 'ds-badge ds-badge--warning',
  error: 'ds-badge ds-badge--error',
};

export function LegalStatusBadge({ status }: LegalStatusBadgeProps) {
  const tone = lawStatusTone(status);
  const className = TONE_CLASS[tone] ?? 'ds-badge';
  return (
    <span className={className} aria-label={`Legal status: ${legalStatusDisplay(status)}`}>
      {legalStatusDisplay(status)}
    </span>
  );
}
