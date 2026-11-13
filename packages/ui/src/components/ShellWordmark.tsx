/**
 * The brand lockup, as one component: the header and the footer both render this, so the
 * artwork paths and the light/dark pairing live in one file and a surface cannot end up with a
 * hand-drawn logo or a lockup that fails to swap on a dark canvas.
 *
 * Which image is visible is CSS, not JavaScript (`shell-header.css`): both are in the DOM and
 * `[data-theme]` picks one, which keeps the swap free of a hydration flash.
 *
 * Plain `<img>`, not `next/image`: this package is framework-neutral, and the artwork is a
 * fixed-size static asset.
 */

import React from 'react';

// Defensive: apps/web SSR tests may classic-transform this package's TSX source.
void React;

/** Light-canvas and dark-canvas paths for one piece of brand artwork. */
export type ShellBrandAssets = {
  readonly light: string;
  readonly dark: string;
};

export type ShellWordmarkProps = {
  /** Light-canvas and dark-canvas lockup paths (official kit artwork). */
  readonly lockup: ShellBrandAssets;
};

export function ShellWordmark({ lockup }: ShellWordmarkProps) {
  return (
    <>
      <img
        className="ds-shell-wordmark__img ds-shell-wordmark__img--theme-light"
        src={lockup.light}
        alt=""
        aria-hidden="true"
      />
      <img
        className="ds-shell-wordmark__img ds-shell-wordmark__img--theme-dark"
        src={lockup.dark}
        alt=""
        aria-hidden="true"
      />
    </>
  );
}
