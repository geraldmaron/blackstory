/**
 * Font Awesome icons for confidence tiers. Paired with accessible labels so
 * color/shape is never the only signal (WCAG 1.4.1), matching KindBadge.
 */
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleHalfStroke,
  faCircleQuestion,
} from '@fortawesome/free-solid-svg-icons';

export type ConfidenceTierKey = 'high' | 'medium' | 'low' | 'unrated';

const CONFIDENCE_ICONS: Readonly<Record<ConfidenceTierKey, IconDefinition>> = {
  high: faCircleCheck,
  medium: faCircleHalfStroke,
  low: faCircleExclamation,
  unrated: faCircleQuestion,
};

export function confidenceIconFor(tier: ConfidenceTierKey): IconDefinition {
  return CONFIDENCE_ICONS[tier];
}
