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
 * THERE IS NO SUSPENSE BOUNDARY HERE, and there must not be one that wraps `children`
 * (repo-bko39). This rendered `<Suspense fallback={<FrameFromPath>{children}</FrameFromPath>}>`
 * around `<FrameFromSearch>{children}</FrameFromSearch>`, handing the entire page to both halves,
 * so React streamed the whole document twice: every shipped page carried two `<main>` landmarks,
 * two `<h1>`s and a duplicate of every id, and the duplicate was about a quarter of the bytes.
 * It was invisible — the retained fallback frame measures 0x0 — so no screenshot or functional
 * check would ever have shown it.
 *
 * The boundary was also unnecessary. Its two branches were the same function: `useSurfaceClass()`
 * reads `usePathname()` and nothing else, so despite the name nothing here ever read search
 * params and nothing ever suspended. If a future surface genuinely needs `useSearchParams()`,
 * wrap THAT component, never this one's children.
 *
 * `<ReadingProgress>` is mounted here too (SP-27, repo-92n2.34), not inside any individual room:
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
