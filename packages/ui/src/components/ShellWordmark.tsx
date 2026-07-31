/**
 * The brand lockup and symbol, as one component.
 *
 * Every surface that shows the mark renders this: the site header, the admin console shell, and
 * the Atlas command bar. That is the whole point — the artwork paths, the light/dark pairing and
 * the `.ds-shell-wordmark__img` class contract live in one file, so a surface cannot end up with
 * a hand-drawn logo, a stale asset path, or a lockup that fails to swap on a dark canvas.
 *
 * Which of the four images is visible is CSS, not JavaScript (`shell-header.css`): all four are in
 * the DOM and `[data-theme]` plus the `--symbol-only` modifier pick one. That keeps the swap free
 * of a hydration flash, which a JS-resolved theme cannot avoid.
 *
 * Plain `<img>`, not `next/image`: this package is framework-neutral and the admin console renders
 * the same mark. The artwork is a fixed-size static asset, so the optimizer has nothing to add.
 */

import type { ShellBrandAssets } from './ShellHeader.js';

export type ShellWordmarkProps = {
  /** Light-canvas and dark-canvas lockup paths (official kit artwork). */
  readonly lockup: ShellBrandAssets;
  /** Light-canvas and dark-canvas symbol paths (official kit artwork). */
  readonly symbol: ShellBrandAssets;
};

export function ShellWordmark({ lockup, symbol }: ShellWordmarkProps) {
  return (
    <>
      <img
        className="ds-shell-wordmark__img ds-shell-wordmark__img--lockup ds-shell-wordmark__img--theme-light"
        src={lockup.light}
        alt=""
        aria-hidden="true"
      />
      <img
        className="ds-shell-wordmark__img ds-shell-wordmark__img--lockup ds-shell-wordmark__img--theme-dark"
        src={lockup.dark}
        alt=""
        aria-hidden="true"
      />
      <img
        className="ds-shell-wordmark__img ds-shell-wordmark__img--symbol ds-shell-wordmark__img--theme-light"
        src={symbol.light}
        alt=""
        aria-hidden="true"
      />
      <img
        className="ds-shell-wordmark__img ds-shell-wordmark__img--symbol ds-shell-wordmark__img--theme-dark"
        src={symbol.dark}
        alt=""
        aria-hidden="true"
      />
    </>
  );
}
