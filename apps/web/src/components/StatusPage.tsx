/**
 * Shared page chrome for loading, error, and not-found states in the public shell.
 */

import React, { type ReactNode } from 'react';

export type StatusPageProps = {
  readonly eyebrow?: string;
  readonly title: string;
  readonly lede?: string;
  readonly busy?: boolean;
  readonly children?: ReactNode;
};

export function StatusPage({ eyebrow, title, lede, busy = false, children }: StatusPageProps) {
  return (
    <main
      className="ds-container ds-page ds-page--status"
      id="main"
      {...(busy ? { 'aria-busy': true, 'aria-live': 'polite' as const } : {})}
    >
      {eyebrow ? <p className="ds-page__eyebrow">{eyebrow}</p> : null}
      <h1 className="ds-page__title">{title}</h1>
      {lede ? <p className="ds-page__lede">{lede}</p> : null}
      {children}
    </main>
  );
}
