/**
 * Homepage beat 05: compact paused atlas timeline preview with explore hand-off.
 */

import React from 'react';
import Link from 'next/link';
import { HomeEditionHeader } from './HomeEditionHeader';

void React;

export function HomeAtlasRewind() {
  return (
    <section className="ds-home-edition__beat" id="beat-e" aria-labelledby="home-atlas-heading">
      <div className="ds-home-edition__atlas-row">
        <div className="ds-home-edition__atlas-copy">
          <HomeEditionHeader
            index="05"
            kicker="Atlas rewind"
            title="Scrub time on the map."
            lede="Coverage thickens where evidence clusters, not where headlines are loudest. The timeline is paused here; open the atlas to move it."
            id="home-atlas-heading"
          />
          <p className="ds-home-edition__beat-cta">
            <Link className="ds-cta ds-cta--quiet" href="/explore">
              Open the full atlas
            </Link>
          </p>
        </div>
        <div className="ds-home-edition__timeline-wrap" aria-hidden="true">
          <svg viewBox="0 0 480 56" fill="none" className="ds-home-edition__timeline-svg">
            <path
              d="M20 32 H460"
              stroke="var(--ds-rule)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M60 26 v12"
              stroke="var(--ds-viz-4)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M120 28 v8"
              stroke="var(--ds-ink-muted)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <path
              d="M180 24 v16"
              stroke="var(--ds-viz-4)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M240 29 v6"
              stroke="var(--ds-ink-muted)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <path
              d="M300 25 v14"
              stroke="var(--ds-viz-4)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M360 28 v8"
              stroke="var(--ds-ink-muted)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <path
              d="M420 23 v18"
              stroke="var(--ds-viz-4)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle
              cx="300"
              cy="32"
              r="8"
              fill="var(--ds-accent-graphic)"
              stroke="var(--ds-surface-raised)"
              strokeWidth="2"
            />
            <path
              d="M296 32 h8"
              stroke="var(--ds-surface-raised)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="ds-home-edition__timeline-labels">
            <span>1790</span>
            <span>1970</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </section>
  );
}
