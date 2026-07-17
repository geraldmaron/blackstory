/**
 * Shared page chrome for loading, error, and not-found states in the public shell.
 */

import type { ReactNode } from 'react';

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
      className="bb-container bb-page bb-page--status"
      id="main"
      {...(busy ? { 'aria-busy': true, 'aria-live': 'polite' as const } : {})}
    >
      {eyebrow ? <p className="bb-page__eyebrow">{eyebrow}</p> : null}
      <h1 className="bb-page__title">{title}</h1>
      {lede ? <p className="bb-page__lede">{lede}</p> : null}
      {children}
    </main>
  );
}
