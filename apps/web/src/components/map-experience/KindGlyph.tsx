/**
 * Kind glyph — the geometric shape channel, at chrome scale.
 *
 * `KindBadge` is the labeled form: icon plus the kind's name, for cards and entity pages. The
 * v9 lens chips and results rows have a 16–18px column and their label is the record's own name,
 * so they need the shape alone. Both read the same `MapEntityGlyph` vocabulary out of
 * `kind-encoding.ts` — circle / square / diamond / ring — which is the non-colour signal the map
 * markers already paint (WCAG 1.4.1, docs/ui/patterns-map-entity-encoding.md).
 *
 * Shade is applied by the caller through `currentColor` rather than baked in: inside a selected
 * results row the glyph turns copper with the rest of the row, and a hard-coded family shade
 * would fight that.
 */
import React from 'react';
import { cx } from '@repo/ui';
import {
  displayEncodingFor,
  kindFamilyEncodingFor,
  type MapEntityGlyph,
  type MapKindFamily,
} from '../../lib/map-experience/kind-encoding';

void React;

export type KindGlyphProps = {
  readonly kind: string;
  readonly mapTone?: string;
  readonly size?: number;
  readonly className?: string;
  /** Set when no adjacent text names the kind. Otherwise the glyph stays decorative. */
  readonly label?: string;
};

function shapeFor(glyph: MapEntityGlyph): React.ReactElement {
  switch (glyph) {
    case 'square':
      return <rect x="3.4" y="3.4" width="9.2" height="9.2" rx="1.2" fill="currentColor" />;
    case 'diamond':
      return <path d="M8 2.6 13.4 8 8 13.4 2.6 8Z" fill="currentColor" />;
    case 'ring':
      return <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />;
    case 'circle':
    default:
      return <circle cx="8" cy="8" r="4.6" fill="currentColor" />;
  }
}

export function KindGlyph({ kind, mapTone, size = 16, className, label }: KindGlyphProps) {
  const glyph = displayEncodingFor(kind, mapTone).glyph;

  return (
    <svg
      className={cx('ds-kind-glyph', className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {shapeFor(glyph)}
    </svg>
  );
}

/** Family-level variant for the lens chips, where the row is a family and not one record. */
export function KindFamilyGlyph({
  family,
  size = 16,
  className,
}: {
  readonly family: MapKindFamily;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <svg
      className={cx('ds-kind-glyph', className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {shapeFor(kindFamilyEncodingFor(family).glyph)}
    </svg>
  );
}
