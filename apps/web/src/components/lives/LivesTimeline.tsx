/**
 * Interactive Lives timeline: scene, lens control, decade rail, panel, and sourced world beats.
 * URL state stays shareable without a full navigation on each control change.
 */
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
  parseLivesSearchParams,
  type LivesViewState,
} from '../../lib/lives/lives-url-state';
import { LIVES_NATIONAL_DOLLAR_FIXTURES } from '../../lib/lives/lives-dollar-fixtures';
import { resolveLivesDecadeMoneyModel } from '../../lib/lives/lives-money-model';
import { LivesPlaceAnchors } from './LivesPlaceAnchors';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { LivesAreaNav } from './LivesAreaNav';
import { LivesClassArcChart } from './LivesClassArcChart';
import { LivesDecadePanel } from './LivesDecadePanel';
import { LivesDecadeRail } from './LivesDecadeRail';
import { LivesScene } from './scene/LivesScene';
import { LivesWorldBeats } from './LivesWorldBeats';

void React;

function sameView(a: LivesViewState, b: LivesViewState): boolean {
  return a.race === b.race && a.decade === b.decade;
}

export type LivesTimelineProps = {
  readonly bundle: LivesAreaBundle;
  readonly areaSlug: string;
  /** When true, omit the area nav (the page already rendered one). */
  readonly hideAreaNav?: boolean;
};

export function LivesTimeline({ bundle, areaSlug, hideAreaNav = false }: LivesTimelineProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [view, setView] = useState<LivesViewState>(() =>
    parseLivesSearchParams(Object.fromEntries(searchParams.entries())),
  );
  const touched = useRef(false);
  const onLivesRoom = pathname === '/lives' || pathname.startsWith('/lives/');

  useEffect(() => {
    const fromUrl = parseLivesSearchParams(Object.fromEntries(searchParams.entries()));
    setView((current) => (sameView(current, fromUrl) ? current : fromUrl));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete('s');
    if (areaSlug === LIVES_NATIONAL.slug) params.delete('area');
    else params.set('area', areaSlug);
    if (view.race !== DEFAULT_LIVES_VIEW.race) params.set('race', view.race);
    else params.delete('race');
    params.delete('tier');
    if (view.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(view.decade));
    else params.delete('decade');
    params.delete('unit');
    const query = params.toString();
    const hash =
      !onLivesRoom && (touched.current || window.location.hash === '#lives') ? '#lives' : '';
    const target = `${query ? `${pathname}?${query}` : pathname}${hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== target) {
      window.history.replaceState(window.history.state, '', target);
    }
  }, [view, pathname, areaSlug, onLivesRoom]);

  function update(patch: Partial<LivesViewState>) {
    touched.current = true;
    setView((current) => ({ ...current, ...patch }));
  }

  const decade = bundle.decades.find((entry) => entry.decade === view.decade) ?? bundle.decades[0];
  if (!decade) return null;
  const panelId = 'lives-decade-panel';
  const money = resolveLivesDecadeMoneyModel({
    decade,
    emphasis: view.race,
    unit: 'household',
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });

  return (
    <div className="lives-timeline">
      <LivesScene
        decade={decade}
        emphasis={view.race}
        unit="household"
        areaSlug={areaSlug}
        {...(money.affordance
          ? {
              affordanceShare: money.affordance.value,
              affordanceCaption: money.affordance.caption,
            }
          : {})}
      />

      {money.derivedIncome ? (
        <p className="lives-money__derived" data-status="derived">
          {money.derivedIncome.caption}
        </p>
      ) : null}

      {hideAreaNav ? null : <LivesAreaNav currentSlug={areaSlug} view={view} />}

      <LivesPlaceAnchors areaSlug={areaSlug} />

      <LivesClassArcChart
        id="lives-class-arc"
        figureLabel="Figure L1"
        bundle={bundle}
        emphasis={view.race}
        selectedDecade={decade.decade}
        onSelectDecade={(next) => update({ decade: next as LivesViewState['decade'] })}
      />

      <div className="lives-controls">
        <fieldset className="lives-controls__group">
          <legend className="lives-controls__legend">
            <DestinationIcon id="filter" className="ds-kicker-glyph" />
            Emphasize
          </legend>
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
      </div>

      <LivesDecadeRail
        decades={bundle.decades}
        selected={decade.decade}
        onSelect={(next) => update({ decade: next as LivesViewState['decade'] })}
        panelId={panelId}
      />

      <p className="lives-sr-only lives-announcer" aria-live="polite">
        Showing the {decade.label}, with {LIVES_LENS_LABELS[view.race]} figures emphasized
      </p>

      <LivesDecadePanel
        id={panelId}
        labelledBy={`lives-decade-${decade.decade}`}
        decade={decade}
        emphasis={view.race}
        disclaimer={bundle.disclaimer}
      />

      <LivesWorldBeats decade={decade.decade} beats={decade.worldBeats} emphasis={view.race} />
    </div>
  );
}
