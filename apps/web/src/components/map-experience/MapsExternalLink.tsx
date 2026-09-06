/**
 * Accessible external link that opens a place in the device maps app (Google Maps universal URL).
 */
import React from 'react';
import { cx } from '@repo/ui';

void React;

export type MapsExternalLinkProps = {
  readonly href: string;
  readonly placeLabel: string;
  readonly className?: string;
  readonly title?: string;
  /**
   * Overrides the accessible name. Needed wherever a surface offers more than one exit for the
   * same place: the default name is identical for all of them, so a screen-reader reader met four
   * links all called "Open <place> in maps" with no way to tell search from directions, or Apple
   * from Google. Callers that draw one exit can leave this alone.
   */
  readonly ariaLabel?: string;
  readonly children: React.ReactNode;
};

export function MapsExternalLink({
  href,
  placeLabel,
  className,
  title,
  ariaLabel,
  children,
}: MapsExternalLinkProps) {
  return (
    <a
      className={cx('ds-maps-external-link', className)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? `Open ${placeLabel} in maps`}
      {...(title ? { title } : {})}
    >
      {children}
    </a>
  );
}
