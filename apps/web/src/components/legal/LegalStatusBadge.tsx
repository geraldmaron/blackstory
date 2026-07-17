/**
 * Law status badge using BB-090 `LawStatus` vocabulary (BB-087 AC8).
 */
import React from 'react';
import { type LawStatus } from '@black-book/domain';
import { lawStatusTone, legalStatusDisplay } from './format';

export type LegalStatusBadgeProps = {
  readonly status: LawStatus;
};

const TONE_CLASS: Readonly<Record<string, string>> = {
  neutral: 'bb-badge',
  info: 'bb-badge bb-badge--info',
  warning: 'bb-badge bb-badge--warning',
  error: 'bb-badge bb-badge--error',
};

export function LegalStatusBadge({ status }: LegalStatusBadgeProps) {
  const tone = lawStatusTone(status);
  const className = TONE_CLASS[tone] ?? 'bb-badge';
  return (
    <span className={className} aria-label={`Legal status: ${legalStatusDisplay(status)}`}>
      {legalStatusDisplay(status)}
    </span>
  );
}
