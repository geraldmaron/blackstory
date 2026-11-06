import React from 'react';
import Link from 'next/link';
import { EmptyState } from '@repo/ui';
import type { CaseQueueMode } from './case-query-params';

void React;

export type CaseQueueEmptyProps = {
  readonly mode: CaseQueueMode;
  /** True when a search, assignee or state filter is narrowing the list. */
  readonly filtered: boolean;
  readonly clearHref: string;
};

/**
 * A narrowed list with no rows offers a way back to the unfiltered view; a desk with nothing in it
 * says so plainly. The two are different facts and never share copy.
 */
export function CaseQueueEmpty({ mode, filtered, clearHref }: CaseQueueEmptyProps) {
  if (filtered) {
    return (
      <EmptyState
        title="No research cases match"
        action={
          <Link className="acq__button acq__button--ghost" href={clearHref}>
            Clear filters
          </Link>
        }
      >
        Nothing in this view fits the current search or filters. Clear them to return to the
        unfiltered list.
      </EmptyState>
    );
  }
  return (
    <EmptyState title={mode === 'inbox' ? 'The inbox is empty' : 'No research cases yet'}>
      {mode === 'inbox'
        ? 'No case is waiting for triage right now.'
        : 'No research case has been opened. New cases appear here once a lead is promoted.'}
    </EmptyState>
  );
}
