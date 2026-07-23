'use client';

/**
 * Decade stepper for `/history` keyboard-accessible tablist switching between all-time
 * and per-decade graph slices derived from published decade artifacts.
 *
 * Uses Next.js `Link` so decade changes soft-navigate (no full document reload). Optional
 * `onSelect` lets a client orchestrator update local state while still keeping shareable hrefs.
 */
import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { cx } from '@repo/ui';
import {
  HISTORY_DECADE_LIST_CLASS,
  HISTORY_DECADE_STEPPER_CLASS,
  HISTORY_DECADE_TAB_CLASS,
} from '../../app/history/history-panel-chrome';
import { buildHistoryHref, type HistoryViewState } from '../../lib/history/url-state';

void React;

export type DecadeStepperProps = {
  readonly decades: readonly string[];
  readonly viewState: HistoryViewState;
  readonly className?: string;
  /** When set, prevents default navigation and calls with `undefined` for all-time. */
  readonly onSelect?: (decade: string | undefined) => void;
};

function stepHref(viewState: HistoryViewState, decade?: string): string {
  const next: HistoryViewState = {
    mode: decade ? 'decade' : 'all-time',
    filters: viewState.filters,
    ...(decade ? { decade } : {}),
  };
  return buildHistoryHref(next);
}

export function DecadeStepper({ decades, viewState, className, onSelect }: DecadeStepperProps) {
  const activeDecade = viewState.mode === 'decade' ? viewState.decade : undefined;
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeDecade, viewState.mode]);

  return (
    <nav
      className={cx(HISTORY_DECADE_STEPPER_CLASS, className)}
      aria-label="Browse by decade"
    >
      <ul className={HISTORY_DECADE_LIST_CLASS} role="tablist" ref={listRef}>
        <li role="presentation">
          <Link
            role="tab"
            className={HISTORY_DECADE_TAB_CLASS}
            href={stepHref(viewState)}
            scroll={false}
            aria-selected={viewState.mode === 'all-time'}
            {...(onSelect
              ? {
                  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                    event.preventDefault();
                    onSelect(undefined);
                  },
                }
              : {})}
          >
            All time
          </Link>
        </li>
        {decades.map((decade) => (
          <li key={decade} role="presentation">
            <Link
              role="tab"
              className={HISTORY_DECADE_TAB_CLASS}
              href={stepHref(viewState, decade)}
              scroll={false}
              aria-selected={activeDecade === decade}
              {...(onSelect
                ? {
                    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                      event.preventDefault();
                      onSelect(decade);
                    },
                  }
                : {})}
            >
              {decade}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
