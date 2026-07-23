/**
 * Confidence mark: Font Awesome icon + accessible label. Record-level confidence
 * is encoded as icon shape (never hue alone) — matches NarrativeCard and the
 * Explore legend so entity pages do not invent a second confidence language.
 *
 * `labeled` shortens the visible word when a nearby "Confidence" field title
 * exists; `title` + aria-label still carry the full plain-language help on hover.
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cx } from '@repo/ui';
import {
  confidenceIconFor,
  type ConfidenceTierKey,
} from '../../lib/map-experience/confidence-icons';
import { iconWithFallback } from '../../lib/map-experience/icon-fallback';
import { confidenceHelp } from '../../lib/map-experience/metadata-help';

void React;

export type { ConfidenceTierKey };
export type ConfidenceTierLabel = 'high' | 'medium' | 'low' | 'unrated' | string;

export type ConfidenceMarkProps = {
  readonly tier: ConfidenceTierLabel;
  readonly className?: string;
  /**
   * True when a Confidence field title / `dt` is already visible beside this mark.
   * Shortens the visible word; screen readers still get the full phrase via aria-label.
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
  const icon = iconWithFallback(confidenceIconFor(tierKey));
  const text = confidenceLabel(tier, labeled);
  const help = confidenceHelp(tierKey);
  const aria = labeled ? `${confidenceShortLabel(tier)} confidence. ${help}` : `${text}. ${help}`;
  return (
    <span
      className={cx('ds-confidence-mark', `ds-confidence-mark--${tierKey}`, className)}
      data-tier={tierKey}
      data-labeled={labeled ? 'true' : 'false'}
      role="img"
      aria-label={aria}
      title={help}
    >
      <FontAwesomeIcon icon={icon} className="ds-confidence-mark__icon" aria-hidden="true" />
      <span className="ds-confidence-mark__text">{text}</span>
    </span>
  );
}
