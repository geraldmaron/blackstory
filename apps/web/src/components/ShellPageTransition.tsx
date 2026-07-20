/**
 * Soft shell-page enter when the App Router remounts `template.tsx`.
 *
 * Deliberately does **not** fade opacity to 0 (exit or enter). Opacity-0 enter
 * hid loading.tsx for `/stories/[slug]` and `/entity/[id]` while Next compiled
 * or streamed — navigations looked broken. Enter is a short translate only
 * (see shell.css). Map surfaces under `(map)/` skip enter via `data-surface="map"`.
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
