/**
 * Theme-impact gap banners — insufficient evidence and modeled estimates.
 * Uses mono text cues (not color-only) via shared Notice component.
 */

import React from 'react';
import { Notice } from '@repo/ui';
import type { ThemeImpactGapState } from './fixtures/types';

export type ThemeImpactGapBannerProps = {
  readonly gapState: ThemeImpactGapState;
};

const GAP_COPY: Readonly<
  Record<
    ThemeImpactGapState,
    { readonly tone: 'warning' | 'dispute'; readonly title: string; readonly body: string }
  >
> = {
  insufficient_evidence: {
    tone: 'warning',
    title: 'Insufficient evidence',
    body:
      'This packet does not yet meet the citation or coverage bar for a full answer. What appears is labeled; gaps stay visible rather than filled with inference.',
  },
  modeled: {
    tone: 'dispute',
    title: 'Modeled estimate',
    body:
      'At least one figure here is derived or modeled — not a direct primary count. Read the provenance list and method note before treating it as a raw observation.',
  },
};

export function ThemeImpactGapBanner({ gapState }: ThemeImpactGapBannerProps) {
  const copy = GAP_COPY[gapState];
  return (
    <Notice tone={copy.tone} title={copy.title}>
      <p style={{ margin: 0 }}>{copy.body}</p>
    </Notice>
  );
}

export type ThemeImpactGapBannerListProps = {
  readonly gapStates: readonly ThemeImpactGapState[];
};

/** Renders one banner per distinct gap state on a packet. */
export function ThemeImpactGapBannerList({ gapStates }: ThemeImpactGapBannerListProps) {
  const unique = [...new Set(gapStates)];
  if (unique.length === 0) return null;

  return (
    <ul className="ds-theme-impact__gap-list" aria-label="Evidence gap labels">
      {unique.map((state) => (
        <li key={state}>
          <ThemeImpactGapBanner gapState={state} />
        </li>
      ))}
    </ul>
  );
}
