/**
 * Interactive Lives timeline: scene, unit/lens/tier controls, decade rail, panel, world beats.
 * URL state stays shareable without a full navigation on each control change.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  LIVES_NATIONAL,
  LIVES_UNITS,
  LIVES_UNIT_KICKERS,
  LIVES_UNIT_LABELS,
  type LivesAreaBundle,
} from '@repo/domain/statistics/lives';
import {
  DEFAULT_LIVES_VIEW,
  LIVES_TIER_PARAMS,
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

const TIER_LABELS = {
  all: 'Everyone',
  lower: 'Lower',
  middle: 'Middle',
  upper: 'Upper',
} as const;

function sameView(a: LivesViewState, b: LivesViewState): boolean {
  return a.race === b.race && a.tier === b.tier && a.decade === b.decade && a.unit === b.unit;
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
    if (view.tier !== DEFAULT_LIVES_VIEW.tier) params.set('tier', view.tier);
    else params.delete('tier');
    if (view.decade !== DEFAULT_LIVES_VIEW.decade) params.set('decade', String(view.decade));
    else params.delete('decade');
    if (view.unit !== DEFAULT_LIVES_VIEW.unit) params.set('unit', view.unit);
    else params.delete('unit');
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
    unit: view.unit,
    observations: LIVES_NATIONAL_DOLLAR_FIXTURES,
  });

  return (
    <div className="lives-timeline">
      <LivesScene
        decade={decade}
        emphasis={view.race}
        unit={view.unit}
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

      <p className="lives-unit-kicker">{LIVES_UNIT_KICKERS[view.unit]}</p>

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
        <fieldset className="lives-controls__group">
          <legend className="lives-controls__legend">
            <DestinationIcon id="person" className="ds-kicker-glyph" />
            Unit
          </legend>
          {LIVES_UNITS.map((unit) => (
            <label key={unit} className="lives-controls__option">
              <input
                type="radio"
                name="lives-unit"
                value={unit}
                checked={view.unit === unit}
                onChange={() => update({ unit })}
              />
              <span>{LIVES_UNIT_LABELS[unit]}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="lives-controls__group">
          <legend className="lives-controls__legend">
            <DestinationIcon id="collection" className="ds-kicker-glyph" />
            Class tier
          </legend>
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
        Showing the {decade.label}, {LIVES_UNIT_LABELS[view.unit]} unit
      </p>

      <LivesDecadePanel
        id={panelId}
        labelledBy={`lives-decade-${decade.decade}`}
        decade={decade}
        emphasis={view.race}
        tier={view.tier}
        unit={view.unit}
        disclaimer={bundle.disclaimer}
      />

      <LivesWorldBeats
        decade={decade.decade}
        beats={decade.worldBeats}
        emphasis={view.race}
        unit={view.unit}
      />
    </div>
  );
}
