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

export type ConfidenceTierKey = 'high' | 'medium' | 'low' | 'unrated';

export type ConfidenceMarkProps = {
  readonly tier: ConfidenceTierLabel;
  readonly className?: string;
};

export function confidenceTierKey(tier: ConfidenceTierLabel): ConfidenceTierKey {
  if (tier === 'high' || tier === 'medium' || tier === 'low' || tier === 'unrated') {
    return tier;
  }
  return 'unrated';
}

export function confidenceLabel(tier: ConfidenceTierLabel): string {
  if (tier === 'unrated') return 'Unrated';
  return `${tier} confidence`;
}

export function ConfidenceMark({ tier, className }: ConfidenceMarkProps) {
  const tierKey = confidenceTierKey(tier);
  const glyph = CONFIDENCE_TIER_GLYPH[tierKey];
  return (
    <span
      className={cx('bp-confidence-mark', `bp-confidence-mark--${tierKey}`, className)}
      data-tier={tierKey}
    >
      <span aria-hidden="true">{glyph}</span> {confidenceLabel(tier)}
    </span>
  );
}
