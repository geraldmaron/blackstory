'use client';

/**
 * Zero-permission place orientation for beat 01: dense state select, Near You secondary,
 * deepest-coverage strip, and quiet locate hand-off.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { US_STATES } from '@repo/domain/map/geography';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { buildExploreHref, defaultExploreOverlayState } from '../../lib/map-experience/url-state';

export type StateStartEntry = {
  readonly postalCode: string;
  readonly name: string;
  readonly count: number;
};

export type StateStartProps = {
  /** States with pinned records, ordered by record count descending. */
  readonly topStates: readonly StateStartEntry[];
};

function exploreHrefForState(postalCode: string): string {
  return buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    state: postalCode,
  });
}

export function StateStart({ topStates }: StateStartProps) {
  const router = useRouter();

  return (
    <div className="ds-home-edition__place-controls-col">
      <div className="ds-home-edition__panel ds-home-edition__place-intro">
        <div className="ds-home-edition__place-row">
          <label className="ds-visually-hidden" htmlFor="home-state-select">
            State
          </label>
          <select
            id="home-state-select"
            className="ds-home-edition__place-select"
            defaultValue=""
            onChange={(event) => {
              const postalCode = event.currentTarget.value;
              if (postalCode) {
                router.push(exploreHrefForState(postalCode));
              }
            }}
          >
            <option value="">Choose your state…</option>
            {US_STATES.map((state) => (
              <option key={state.postalCode} value={state.postalCode}>
                {state.name}
              </option>
            ))}
          </select>
          <Link className="ds-cta ds-cta--ghost ds-home-edition__place-near" href="/locate">
            Near You
          </Link>
        </div>
        <p className="ds-home-edition__place-locate">
          Or <Link href="/locate">locate me on the map</Link> to see records within a radius of
          where you stand.
        </p>
      </div>

      {topStates.length > 0 ? (
        <div className="ds-home-edition__presence-strip">
          <p className="ds-home-edition__presence-label" id="home-presence-label">
            Deepest coverage in this release
          </p>
          <ul className="ds-home-edition__presence-list" aria-labelledby="home-presence-label">
            {topStates.map((state) => (
              <li key={state.postalCode}>
                <Link className="ds-home-edition__presence-link" href={exploreHrefForState(state.postalCode)}>
                  <span className="ds-home-edition__presence-name">{state.name}</span>
                  <span className="ds-home-edition__presence-count">
                    {state.count} rec
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
