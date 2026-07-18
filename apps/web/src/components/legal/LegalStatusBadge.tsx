/**
 * Law status badge using `LawStatus` vocabulary.
 */
import React from 'react';
import { type LawStatus } from '@blap/domain';
import { lawStatusTone, legalStatusDisplay } from './format';

export type LegalStatusBadgeProps = {
  readonly status: LawStatus;
};

const TONE_CLASS: Readonly<Record<string, string>> = {
  neutral: 'bp-badge',
  info: 'bp-badge bp-badge--info',
  warning: 'bp-badge bp-badge--warning',
  error: 'bp-badge bp-badge--error',
};

export function LegalStatusBadge({ status }: LegalStatusBadgeProps) {
  const tone = lawStatusTone(status);
  const className = TONE_CLASS[tone] ?? 'bp-badge';
  return (
    <span className={className} aria-label={`Legal status: ${legalStatusDisplay(status)}`}>
      {legalStatusDisplay(status)}
    </span>
  );
}
