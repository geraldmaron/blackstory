/**
 * Decade stepper for BB-093 `/history` — keyboard-accessible tablist switching between all-time
 * and per-decade graph slices derived from BB-092 published decade artifacts.
 */
import React from 'react';
import { cx } from '@black-book/ui';
import { buildHistoryHref, type HistoryViewState } from '../../lib/history/url-state';

void React;

export type DecadeStepperProps = {
  readonly decades: readonly string[];
  readonly viewState: HistoryViewState;
  readonly className?: string;
};

function stepHref(viewState: HistoryViewState, decade?: string): string {
  const next: HistoryViewState = {
    mode: decade ? 'decade' : 'all-time',
    filters: viewState.filters,
    ...(decade ? { decade } : {}),
  };
  return buildHistoryHref(next);
}

export function DecadeStepper({ decades, viewState, className }: DecadeStepperProps) {
  const activeDecade = viewState.mode === 'decade' ? viewState.decade : undefined;

  return (
    <nav className={cx('bb-history-stepper', className)} aria-label="Browse by decade">
      <ul className="bb-history-stepper__list" role="tablist">
        <li role="presentation">
          <a
            role="tab"
            className={cx('bb-history-stepper__tab', viewState.mode === 'all-time' && 'bb-history-stepper__tab--active')}
            href={stepHref(viewState)}
            aria-selected={viewState.mode === 'all-time'}
          >
            All time
          </a>
        </li>
        {decades.map((decade) => (
          <li key={decade} role="presentation">
            <a
              role="tab"
              className={cx(
                'bb-history-stepper__tab',
                activeDecade === decade && 'bb-history-stepper__tab--active',
              )}
              href={stepHref(viewState, decade)}
              aria-selected={activeDecade === decade}
            >
              {decade}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
