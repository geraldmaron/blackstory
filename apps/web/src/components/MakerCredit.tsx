/**
 * Quiet maker attribution linking to geralddagher.com with the GD brand mark.
 * `footer` sits on the fixed Black Ink plate (white mark only). `inline` follows
 * `[data-theme]` so light and dark surfaces each get the correct mark.
 */

import React from 'react';
import { MAKER } from '@repo/config';

void React;

export type MakerCreditProps = {
  /** `footer` = fixed-ink plate; `inline` = theme-following surfaces. */
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
        {variant === 'footer' ? (
          // Fixed-ink footer always uses the white mark.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="ds-maker-credit__mark"
            src={MAKER.mark.dark}
            alt=""
            width={40}
            height={40}
            decoding="async"
          />
        ) : (
          <>
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
          </>
        )}
        <span className="ds-maker-credit__label">
          Built by <span className="ds-maker-credit__name">{MAKER.name}</span>
        </span>
      </a>
    </p>
  );
}
