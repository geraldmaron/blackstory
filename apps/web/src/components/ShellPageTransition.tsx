/**
 * Soft shell-page enter opacity when the App Router remounts `template.tsx`.
 *
 * Deliberately does **not** fade the current page out on link click. An early
 * exit-to-transparent left a blank canvas for seconds while Next compiled or
 * streamed `/stories/[slug]` and `/entity/[id]` — navigation felt broken.
 * Map surfaces under `(map)/` still skip enter via `data-surface="map"` in CSS.
 */
'use client';

import { type ReactNode } from 'react';
import { PageField, usePageFieldSelection } from './PageField';

export type ShellPageTransitionProps = {
  readonly children: ReactNode;
};

export function ShellPageTransition({ children }: ShellPageTransitionProps) {
  const pageField = usePageFieldSelection();

  return (
    <div className="ds-shell-page-transition" data-page-field={pageField?.motifId ?? 'none'}>
      {pageField ? <PageField selection={pageField} /> : null}
      <div className="ds-shell-page-transition__content">{children}</div>
    </div>
  );
}
