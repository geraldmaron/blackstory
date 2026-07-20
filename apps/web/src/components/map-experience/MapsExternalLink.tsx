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
  readonly children: React.ReactNode;
};

export function MapsExternalLink({
  href,
  placeLabel,
  className,
  title,
  children,
}: MapsExternalLinkProps) {
  return (
    <a
      className={cx('ds-maps-external-link', className)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${placeLabel} in maps`}
      {...(title ? { title } : {})}
    >
      {children}
    </a>
  );
}
