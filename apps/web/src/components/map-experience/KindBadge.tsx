/**
 * Kind badge: shade + Font Awesome icon + label for entity kinds. Color is never
 * the only signal (WCAG 1.4.1) — pairs the map legend encoding with readable text
 * so the NarrativeCard, result list, and entity page stay visually consistent with
 * the Explore map markers (which keep geometric glyphs).
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cx } from '@repo/ui';
import { displayEncodingFor } from '../../lib/map-experience/kind-encoding';
import { kindIconFor } from '../../lib/map-experience/kind-icons';

void React;

export type KindBadgeProps = {
  readonly kind: string;
  /** Semantic tone override (massacre / plantation / epicenter) when known. */
  readonly mapTone?: string;
  readonly className?: string;
  /** Compact mono row for result lists; default is the card/eyebrow chip. */
  readonly density?: 'default' | 'compact';
};

export function KindBadge({ kind, mapTone, className, density = 'default' }: KindBadgeProps) {
  const encoding = displayEncodingFor(kind, mapTone);
  const icon = kindIconFor(kind, mapTone);

  return (
    <span
      className={cx('ds-kind-badge', density === 'compact' && 'ds-kind-badge--compact', className)}
      data-kind={kind}
      {...(mapTone ? { 'data-map-tone': mapTone } : {})}
    >
      <FontAwesomeIcon
        icon={icon}
        className="ds-kind-badge__icon"
        style={{ color: encoding.shade }}
        aria-hidden="true"
      />
      <span className="ds-kind-badge__label">{encoding.label}</span>
    </span>
  );
}
