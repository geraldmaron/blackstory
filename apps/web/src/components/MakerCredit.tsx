/**
 * Quiet maker attribution linking to geralddagher.com with the GD brand mark.
 * Footer and inline variants both swap light/dark marks with [data-theme]; footer
 * uses accent link styling on the canvas plate, inline uses muted ink on document surfaces.
 */

import React from 'react';
import { MAKER } from '@repo/config';

void React;

export type MakerCreditProps = {
  /** `footer` = canvas plate accent link; `inline` = theme-following muted link. */
  readonly variant: 'footer' | 'inline';
  /** Optional class for the outer paragraph/wrapper. */
  readonly className?: string;
};

export function MakerCredit({ variant, className }: MakerCreditProps) {
  const rootClass =
    variant === 'footer'
      ? ['ds-maker-credit', 'ds-maker-credit--footer', className].filter(Boolean).join(' ')
      : ['ds-maker-credit', 'ds-maker-credit--inline', className].filter(Boolean).join(' ');

  return (
    <p className={rootClass}>
      <a
        className={
          variant === 'footer' ? 'ds-maker-credit__link ds-shell-footer__operator' : 'ds-maker-credit__link'
        }
        href={MAKER.url}
        rel="noopener noreferrer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="ds-maker-credit__mark ds-maker-credit__mark--theme-light"
          src={MAKER.mark.light}
          alt=""
          width={40}
          height={40}
          decoding="async"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="ds-maker-credit__mark ds-maker-credit__mark--theme-dark"
          src={MAKER.mark.dark}
          alt=""
          width={40}
          height={40}
          decoding="async"
        />
        <span className="ds-maker-credit__label">
          Built by <span className="ds-maker-credit__name">{MAKER.name}</span>
        </span>
      </a>
    </p>
  );
}
