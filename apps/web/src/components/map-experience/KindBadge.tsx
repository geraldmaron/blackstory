/**
 * Kind badge: shade + glyph + label for entity kinds. Color is never the only
 * signal (WCAG 1.4.1) — pairs the map legend encoding with readable text so the
 * NarrativeCard, result list, and entity page stay visually consistent with the
 * Explore map markers.
 */
import React from 'react';
import { cx } from '@repo/ui';
import {
  displayEncodingFor,
  type MapEntityGlyph,
} from '../../lib/map-experience/kind-encoding';

void React;

const GLYPH_CLASS: Readonly<Record<MapEntityGlyph, string>> = {
  circle: 'ds-legend-glyph--circle',
  square: 'ds-legend-glyph--square',
  diamond: 'ds-legend-glyph--diamond',
  ring: 'ds-legend-glyph--ring',
};

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
  const glyphStyle =
    encoding.glyph === 'ring'
      ? { borderColor: encoding.shade, backgroundColor: 'transparent' as const }
      : { backgroundColor: encoding.shade, borderColor: encoding.shade };

  return (
    <span
      className={cx('ds-kind-badge', density === 'compact' && 'ds-kind-badge--compact', className)}
      data-kind={kind}
      {...(mapTone ? { 'data-map-tone': mapTone } : {})}
    >
      <span
        className={cx('ds-legend-glyph', GLYPH_CLASS[encoding.glyph])}
        style={glyphStyle}
        aria-hidden="true"
      />
      <span className="ds-kind-badge__label">{encoding.label}</span>
    </span>
  );
}
