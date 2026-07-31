/**
 * The page-root wrapper the App Router remounts on every navigation.
 *
 * It carries `data-surface`, the surface class of the route being rendered
 * (`docs/ui/patterns-surface-classes.md`). This is the one place the class is emitted, and it
 * is emitted here rather than on each page's `<main>` so that a new route cannot ship without
 * one: `lib/nav/surface-classes.ts` owns the table and its coverage test walks the route tree.
 * The wrapper is server-rendered, so the attribute is in the first painted HTML and shell CSS
 * can read it before hydration.
 *
 * There is no enter animation. The transform-based one that used to live here set
 * `animation-fill-mode: both`, which leaves a permanently non-`none` computed transform and
 * makes this element the containing block for the fixed map plate — the plate then scrolls with
 * the document instead of holding the viewport. A `:has()` escape hatch keyed on a marker
 * attribute a route happened to set was the only thing preventing that, and a 0.2rem translate
 * was never worth a rule that silently stops applying when the markup changes.
 */
'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { surfaceClassFor } from '../lib/nav/surface-classes';
import { PageField, usePageFieldSelection } from './PageField';

export type ShellPageTransitionProps = {
  readonly children: ReactNode;
};

export function ShellPageTransition({ children }: ShellPageTransitionProps) {
  const pathname = usePathname() || '/';
  const surface = surfaceClassFor(pathname);
  const pageField = usePageFieldSelection();

  return (
    <div
      className="ds-shell-page-transition"
      {...(surface ? { 'data-surface': surface } : {})}
      data-page-field={pageField?.motifId ?? 'none'}
    >
      {pageField ? <PageField selection={pageField} /> : null}
      <div className="ds-shell-page-transition__content">{children}</div>
    </div>
  );
}
