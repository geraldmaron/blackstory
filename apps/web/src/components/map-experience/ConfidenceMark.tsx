/**
 * Confidence mark: map-aligned glyph + word label. Record-level confidence is
 * encoded as shape (● ◐ ○ ·), never hue alone — matches NarrativeCard and the
 * Explore legend so entity pages do not invent a second confidence language.
 *
 * When a nearby "Confidence" field title is present, pass `labeled` so the
 * value is just High / Medium / Low / Unrated (the field name is not repeated).
 * Without a field title, the full phrase ("high confidence") stays for context.
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
  /**
   * True when a Confidence field title / `dt` is already visible beside this mark.
   * Shortens the visible word to High / Medium / Low / Unrated.
   */
  readonly labeled?: boolean;
};

export function confidenceTierKey(tier: ConfidenceTierLabel): ConfidenceTierKey {
  if (tier === 'high' || tier === 'medium' || tier === 'low' || tier === 'unrated') {
    return tier;
  }
  return 'unrated';
}

/** Short value when the Confidence field is already titled. */
export function confidenceShortLabel(tier: ConfidenceTierLabel): string {
  const key = confidenceTierKey(tier);
  if (key === 'unrated') return 'Unrated';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Full phrase when there is no Confidence field title nearby. */
export function confidenceLabel(tier: ConfidenceTierLabel, labeled = false): string {
  if (labeled) return confidenceShortLabel(tier);
  if (tier === 'unrated') return 'Unrated';
  return `${confidenceTierKey(tier)} confidence`;
}

export function ConfidenceMark({ tier, className, labeled = false }: ConfidenceMarkProps) {
  const tierKey = confidenceTierKey(tier);
  const glyph = CONFIDENCE_TIER_GLYPH[tierKey];
  const text = confidenceLabel(tier, labeled);
  return (
    <span
      className={cx('bp-confidence-mark', `bp-confidence-mark--${tierKey}`, className)}
      data-tier={tierKey}
      data-labeled={labeled ? 'true' : 'false'}
    >
      <span aria-hidden="true">{glyph}</span>{' '}
      <span className="bp-confidence-mark__text">{text}</span>
    </span>
  );
}
