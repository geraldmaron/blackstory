'use client';

/**
 * Accessible external link that opens a place in the reader's own maps app: Google Maps by
 * default (server-rendered), Apple Maps on iPhone, iPad and Mac (swapped in after mount so the
 * server and client markup agree on first paint).
 */
import React, { useEffect, useState } from 'react';
import { cx } from '@repo/ui';
import { appleMapsUrlFromGoogle, prefersAppleMaps } from '../../lib/geography/external-maps-url';

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
  /**
   * Swap a Google Maps link for Apple Maps on Apple devices (default true). `MapsHandoff`, which
   * names each provider explicitly, turns this off.
   */
  readonly platformAware?: boolean;
};

export function MapsExternalLink({
  href,
  placeLabel,
  className,
  title,
  ariaLabel,
  children,
  platformAware = true,
}: MapsExternalLinkProps) {
  const [resolvedHref, setResolvedHref] = useState(href);
  useEffect(() => {
    if (!platformAware || typeof navigator === 'undefined') {
      setResolvedHref(href);
      return;
    }
    const apple = prefersAppleMaps(navigator.userAgent, navigator.platform)
      ? appleMapsUrlFromGoogle(href)
      : undefined;
    setResolvedHref(apple ?? href);
  }, [href, platformAware]);
  return (
    <a
      className={cx('ds-maps-external-link', className)}
      href={resolvedHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? `Open ${placeLabel} in maps`}
      {...(title ? { title } : {})}
    >
      {children}
    </a>
  );
}
