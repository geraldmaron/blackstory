'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  LIVES_NATIONAL,
  type LivesAreaBundle,
} from '@repo/domain/statistics/lives';
import {
  DEFAULT_LIVES_VIEW,
  LIVES_TIER_PARAMS,
  parseLivesSearchParams,
  type LivesViewState,
} from '../../lib/lives/lives-url-state';
import { LivesDecadePanel } from './LivesDecadePanel';
import { LivesDecadeRail } from './LivesDecadeRail';

void React;

const TIER_LABELS = {
  all: 'Everyone',
  lower: 'Lower',
  middle: 'Middle',
  upper: 'Upper',
} as const;

function sameView(a: LivesViewState, b: LivesViewState): boolean {
  return a.race === b.race && a.tier === b.tier && a.decade === b.decade;
}

export type LivesTimelineProps = {
  readonly bundle: LivesAreaBundle;
  readonly areaSlug: string;
};

/**
 * The interactive timeline. The view renders from local state so rapid changes never read a stale
 * URL, and the URL follows with `history.replaceState` (which Next keeps in sync with
 * `useSearchParams`) so a copied link reopens the same decade, lens and tier without a server
 * round trip. Back and forward resync the state from the URL.
 */
export function LivesTimeline({ bundle, areaSlug }: LivesTimelineProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [view, setView] = useState<LivesViewState>(() =>
    parseLivesSearchParams(Object.fromEntries(searchParams.entries())),
  );
  const touched = useRef(false);

  useEffect(() => {
    const fromUrl = parseLivesSearchParams(Object.fromEntries(searchParams.entries()));
    setView((current) => (sameView(current, fromUrl) ? current : fromUrl));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (touched.current) params.set('s', 'lives');
    if (areaSlug === LIVES_NATIONAL.slug) params.delete('area');
    else params.set('area', areaSlug);
    if (view.race !== DEFAULT_LIVES_VIEW.race) params.set('race', view.race);
    else params.delete('race');
    if (view.tier !== DEFAULT_LIVES_VIEW.tier) params.set('tier', view.tier);
    else params.delete('tier');
    if (view.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(view.decade));
    else params.delete('decade');
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.replaceState(window.history.state, '', target);
    }
  }, [view, pathname, areaSlug]);

  function update(patch: Partial<LivesViewState>) {
    touched.current = true;
    setView((current) => ({ ...current, ...patch }));
  }

  const decade = bundle.decades.find((entry) => entry.decade === view.decade) ?? bundle.decades[0];
  if (!decade) return null;
  const panelId = 'lives-decade-panel';

  return (
    <div className="lives-timeline">
      <div className="lives-controls">
        <fieldset className="lives-controls__group">
          <legend>Emphasize</legend>
          {LIVES_LENSES.map((lens) => (
            <label key={lens} className="lives-controls__option">
              <input
                type="radio"
                name="lives-race"
                value={lens}
                checked={view.race === lens}
                onChange={() => update({ race: lens })}
              />
              <span>{LIVES_LENS_LABELS[lens]}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="lives-controls__group">
          <legend>Class tier</legend>
          {LIVES_TIER_PARAMS.map((tier) => (
            <label key={tier} className="lives-controls__option">
              <input
                type="radio"
                name="lives-tier"
                value={tier}
                checked={view.tier === tier}
                onChange={() => update({ tier })}
              />
              <span>{TIER_LABELS[tier]}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <LivesDecadeRail
        decades={bundle.decades}
        selected={decade.decade}
        onSelect={(next) => update({ decade: next as LivesViewState['decade'] })}
        panelId={panelId}
      />

      <p className="lives-sr-only lives-announcer" aria-live="polite">
        Showing the {decade.label}
      </p>

      <LivesDecadePanel
        id={panelId}
        labelledBy={`lives-decade-${decade.decade}`}
        decade={decade}
        emphasis={view.race}
        tier={view.tier}
        disclaimer={bundle.disclaimer}
      />
    </div>
  );
}
