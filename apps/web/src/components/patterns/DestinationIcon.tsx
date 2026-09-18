/**
 * Decorative destination glyph. The visible label beside it is the accessible name
 * (WCAG 1.4.1): color and shape never replace the word.
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { DestinationIconId } from '@repo/public-contracts/destinations';
import { cx } from '@repo/ui';
import { destinationGlyphFor } from '../../lib/nav/destination-icons';
import { iconWithFallback } from '../../lib/map-experience/icon-fallback';
import './destination-icon.css';

void React;

export type DestinationIconProps = {
  readonly id: DestinationIconId;
  readonly className?: string;
  readonly size?: 'sm' | 'md' | 'lg';
};

export function DestinationIcon({ id, className, size = 'sm' }: DestinationIconProps) {
  return (
    <FontAwesomeIcon
      icon={iconWithFallback(destinationGlyphFor(id))}
      className={cx(
        'ds-destination-icon',
        size === 'md' && 'ds-destination-icon--md',
        size === 'lg' && 'ds-destination-icon--lg',
        className,
      )}
      aria-hidden="true"
    />
  );
}
