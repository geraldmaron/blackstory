/**
 * Kind badge: shade + glyph + label for entity kinds. Color is never the only
 * signal (WCAG 1.4.1) — pairs the map legend encoding with readable text so the
 * NarrativeCard, result list, and entity page stay visually consistent with the
 * Explore map markers.
 */
import React from 'react';
import { cx } from '@blap/ui';
import { kindEncodingFor, type MapEntityGlyph } from '../../lib/map-experience/kind-encoding';

void React;

const GLYPH_CLASS: Readonly<Record<MapEntityGlyph, string>> = {
  circle: 'bp-legend-glyph--circle',
  square: 'bp-legend-glyph--square',
  diamond: 'bp-legend-glyph--diamond',
  ring: 'bp-legend-glyph--ring',
};

export type KindBadgeProps = {
  readonly kind: string;
  readonly className?: string;
  /** Compact mono row for result lists; default is the card/eyebrow chip. */
  readonly density?: 'default' | 'compact';
};

export function KindBadge({ kind, className, density = 'default' }: KindBadgeProps) {
  const encoding = kindEncodingFor(kind);
  const glyphStyle =
    encoding.glyph === 'ring'
      ? { borderColor: encoding.shade, backgroundColor: 'transparent' as const }
      : { backgroundColor: encoding.shade, borderColor: encoding.shade };

  return (
    <span
      className={cx('bp-kind-badge', density === 'compact' && 'bp-kind-badge--compact', className)}
      data-kind={kind}
    >
      <span
        className={cx('bp-legend-glyph', GLYPH_CLASS[encoding.glyph])}
        style={glyphStyle}
        aria-hidden="true"
      />
      <span className="bp-kind-badge__label">{encoding.label}</span>
    </span>
  );
}
