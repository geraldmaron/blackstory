/**
 * Soft shell-page enter/exit opacity around App Router navigations.
 *
 * Template remount re-runs the enter fade. Exit fade starts on same-origin
 * internal link clicks (capture phase) so stories↔history feels like a
 * crossfade rather than a hard refresh. Map surfaces (`data-surface="map"`)
 * skip exit so the persistent canvas is never faded (ADR-017).
 */
'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { PageField, usePageFieldSelection } from './PageField';

export type ShellPageTransitionProps = {
  readonly children: ReactNode;
};

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function resolveInternalPath(anchor: HTMLAnchorElement): string | null {
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return null;
  return next;
}

export function ShellPageTransition({ children }: ShellPageTransitionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pageField = usePageFieldSelection();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClickCapture = (event: MouseEvent) => {
      if (isModifiedClick(event) || event.defaultPrevented) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-surface="map"]')) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!resolveInternalPath(anchor)) return;

      root.classList.add('ds-shell-page-transition--exit');
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);

  return (
    <div
      ref={rootRef}
      className="ds-shell-page-transition"
      data-page-field={pageField?.motifId ?? 'none'}
    >
      {pageField ? <PageField selection={pageField} /> : null}
      <div className="ds-shell-page-transition__content">{children}</div>
    </div>
  );
}
