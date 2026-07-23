/**
 * Theme-impact gap banners — insufficient evidence and modeled estimates.
 * Uses mono text cues (not color-only) via shared Notice component.
 */

import React from 'react';
import { Notice } from '@repo/ui';
import type { ThemeImpactGapState } from './fixtures/types';
import { THEME_IMPACT_GAP_COPY } from './theme-impact-copy';

export type ThemeImpactGapBannerProps = {
  readonly gapState: ThemeImpactGapState;
};

export function ThemeImpactGapBanner({ gapState }: ThemeImpactGapBannerProps) {
  const copy = THEME_IMPACT_GAP_COPY[gapState];
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
