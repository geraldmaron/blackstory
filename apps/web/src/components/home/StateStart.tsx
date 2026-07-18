'use client';

/**
 * "Start with your state" (design-direction-v5 §6.2) — the zero-permission
 * orientation control: a native state select covering all 51 states/D.C.
 * (readers can pick a state with no records yet — /explore frames that
 * honestly and suggests other paths), one-tap chips for the states with the
 * deepest coverage, and a quiet hand-off to /locate for readers who choose
 * to share their location.
 *
 * Navigation is router.push (continuous-experience contract): the persistent
 * map canvas survives the transition and flies to the state's camera preset
 * when /explore reads the ?state= param.
 */

import { useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { US_STATES } from '@repo/domain/map/geography';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { buildExploreHref } from '../../lib/map-experience/url-state';

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
    density: false,
    group: false,
    lines: false,
    state: postalCode,
  });
}

export function StateStart({ topStates }: StateStartProps) {
  const router = useRouter();
  const [selected, setSelected] = useState('');

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (selected) {
      router.push(exploreHrefForState(selected));
    }
  }

  return (
    <div className="ds-state-start">
      <form className="ds-state-start__form" onSubmit={handleSubmit}>
        <label className="ds-visually-hidden" htmlFor="state-start-select">
          Your state
        </label>
        <select
          id="state-start-select"
          className="ds-state-start__select"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Choose your state…</option>
          {US_STATES.map((state) => (
            <option key={state.postalCode} value={state.postalCode}>
              {state.name}
            </option>
          ))}
        </select>
        <button className="ds-button ds-button--secondary" type="submit" disabled={!selected}>
          See its records
        </button>
      </form>

      {topStates.length > 0 ? (
        <ul className="ds-state-start__chips" aria-label="States with the most records">
          {topStates.map((state) => (
            <li key={state.postalCode}>
              <Link className="ds-state-chip" href={exploreHrefForState(state.postalCode)}>
                {state.name}
                <span className="ds-state-chip__count">{state.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="ds-state-start__locate">
        Standing somewhere with a story? <Link href="/locate">Use your location</Link> — read only
        with your permission, never stored.
      </p>
    </div>
  );
}
