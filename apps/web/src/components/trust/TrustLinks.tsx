/**
 * Where a trust page points onward: ruled rows of a name and one line. A row that points at a
 * catalog destination carries that destination's glyph beside its name, so onward links read the
 * same here as in the footer and Rooms. The whole row is the link.
 */
import React from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';
import { destinationFor } from '../../lib/nav/destination-registry';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

export type TrustLink = {
  readonly href: string;
  readonly title: string;
  readonly line?: string;
};

export type TrustLinksProps = {
  readonly links: readonly TrustLink[];
  /** Names the group for assistive tech ("Related pages"). */
  readonly label?: string;
  readonly className?: string;
};

export function TrustLinks({ links, label = 'Related pages', className }: TrustLinksProps) {
  return (
    <ul className={cx('ds-trust-links', className)} aria-label={label}>
      {links.map((link) => {
        const external = /^(https?:|mailto:)/.test(link.href);
        const icon = external ? undefined : destinationFor(link.href.split(/[?#]/)[0] ?? '')?.icon;
        const body = (
          <>
            <span className="ds-trust-links__title ds-destination-label">
              {icon ? <DestinationIcon id={icon} className="ds-trust-links__icon" /> : null}
              {link.title}
            </span>
            {link.line ? <span className="ds-trust-links__line">{link.line}</span> : null}
            <svg className="ds-trust-links__arrow" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 8h10m-4-4 4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        );
        return (
          <li key={link.href}>
            {external ? (
              <a className="ds-trust-links__row" href={link.href} rel="noopener noreferrer">
                {body}
              </a>
            ) : (
              <Link className="ds-trust-links__row" href={link.href}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
