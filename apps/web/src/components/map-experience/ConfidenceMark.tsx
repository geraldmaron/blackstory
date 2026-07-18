/**
 * Confidence mark: map-aligned glyph + word label. Record-level confidence is
 * encoded as shape (● ◐ ○ ·), never hue alone — matches NarrativeCard and the
 * Explore legend so entity pages do not invent a second confidence language.
 */
import React from 'react';
import { cx } from '@blap/ui';
import { CONFIDENCE_TIER_GLYPH } from '../../lib/map-experience/dignity-style';

void React;

export type ConfidenceTierLabel = 'high' | 'medium' | 'low' | 'unrated' | string;

export type ConfidenceMarkProps = {
  readonly tier: ConfidenceTierLabel;
  readonly className?: string;
};

export function confidenceLabel(tier: ConfidenceTierLabel): string {
  if (tier === 'unrated') return 'Unrated';
  return `${tier} confidence`;
}

export function ConfidenceMark({ tier, className }: ConfidenceMarkProps) {
  const glyph = CONFIDENCE_TIER_GLYPH[tier] ?? CONFIDENCE_TIER_GLYPH.unrated;
  return (
    <span className={cx('bp-confidence-mark', className)}>
      <span aria-hidden="true">{glyph}</span> {confidenceLabel(tier)}
    </span>
  );
}
