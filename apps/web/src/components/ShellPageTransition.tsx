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
 * There is no enter animation: animations on this element interfere with the fixed map plate's
 * containing block behavior, making the plate scroll with the document instead of holding the
 * viewport.
 *
 * THERE IS NO SUSPENSE BOUNDARY HERE, and there must not be one that wraps `children`.
 * A page-root Suspense fallback would render `<FrameFromPath>{children}</FrameFromPath>`
 * around `<FrameFromSearch>{children}</FrameFromSearch>`, handing the entire page to both halves.
 * React would then stream duplicate landmarks, headings, and ids while the fallback remains
 * visually hidden at 0x0.
 *
 * `useSurfaceClass()` reads `usePathname()` and does not suspend. A component that genuinely uses
 * `useSearchParams()` must own a local boundary rather than wrapping this component's children.
 *
 * `<ReadingProgress>` is mounted here too, not inside any individual room:
 * this is the one place `surface` is already resolved for every route, so it is also the one
 * place the progress rule can be class-wide rather than something each Reading screen has to
 * remember to render. The component itself decides whether that renders anything; see its own
 * doc comment.
 */
'use client';

import { type ReactNode } from 'react';
import type { SurfaceClass } from '../lib/nav/surface-classes';
import { useSurfaceClass } from '../lib/nav/use-surface-class';
import { PageField, usePageFieldSelection } from './PageField';
import { ReadingProgress } from './room/ReadingProgress';

export type ShellPageTransitionProps = {
  readonly children: ReactNode;
};

export function ShellPageTransition({ children }: ShellPageTransitionProps) {
  return <ShellPageChrome surface={useSurfaceClass()}>{children}</ShellPageChrome>;
}

function ShellPageChrome({
  children,
  surface,
}: {
  readonly children: ReactNode;
  readonly surface: SurfaceClass | null;
}) {
  const pageField = usePageFieldSelection();

  return (
    <div
      className="ds-shell-page-transition"
      {...(surface ? { 'data-surface': surface } : {})}
      data-page-field={pageField?.motifId ?? 'none'}
    >
      <ReadingProgress surface={surface} />
      {pageField ? <PageField selection={pageField} /> : null}
      <div className="ds-shell-page-transition__content">{children}</div>
    </div>
  );
}
