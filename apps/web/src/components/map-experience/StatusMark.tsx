/**
 * Status mark: Font Awesome icon + short lifecycle label. Used beside KindBadge /
 * ConfidenceMark so status reads as a compact indicator, not a large text chip.
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cx } from '@repo/ui';
import { statusIconFor, statusShortLabel } from '../../lib/map-experience/status-icons';

void React;

export type StatusMarkProps = {
  readonly status: string;
  readonly className?: string;
  /** When a Status field title is already visible, keep the word compact. */
  readonly labeled?: boolean;
};

export function StatusMark({ status, className, labeled = false }: StatusMarkProps) {
  const icon = statusIconFor(status);
  const label = statusShortLabel(status);
  return (
    <span
      className={cx('ds-status-mark', `ds-status-mark--${status}`, className)}
      data-status={status}
      data-labeled={labeled ? 'true' : 'false'}
      role="img"
      aria-label={`Status: ${label}`}
    >
      <FontAwesomeIcon icon={icon} className="ds-status-mark__icon" aria-hidden="true" />
      <span className="ds-status-mark__text">{label}</span>
    </span>
  );
}
