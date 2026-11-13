/**
 * The evidence appendix instrument: one control row (Area, Decade, Emphasize), then one result
 * panel: the class arc with the chosen decade marked, the area's description, and that decade's
 * panel under it. URL state stays shareable without a full navigation on each change; an area is
 * a link because it loads a different snapshot.
 */
'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LIVES_AREAS,
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  LIVES_NATIONAL,
  livesAreaBySlug,
  type LivesAreaBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { Segmented } from '@repo/ui';
import {
  DEFAULT_LIVES_VIEW,
  buildLivesHref,
  parseLivesSearchParams,
  type LivesViewState,
} from '../../lib/lives/lives-url-state';
import { LivesClassArcChart } from './LivesClassArcChart';
import { LivesDecadePanel } from './LivesDecadePanel';
import { LivesPlaceAnchors } from './LivesPlaceAnchors';
import { DisclosureCaret } from './DisclosureCaret';

void React;

function sameView(a: LivesViewState, b: LivesViewState): boolean {
  return a.race === b.race && a.decade === b.decade;
}

export type LivesTimelineProps = {
  readonly bundle: LivesAreaBundle;
  readonly areaSlug: string;
};

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
    if (!touched.current) return;
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
    const target = query ? `${pathname}?${query}` : pathname;
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.replaceState(window.history.state, '', target);
    }
  }, [view, pathname, areaSlug]);

  function update(patch: Partial<LivesViewState>) {
    touched.current = true;
    setView((current) => ({ ...current, ...patch }));
  }

  const decade =
    bundle.decades.find((entry) => entry.decade === view.decade) ?? bundle.decades.at(-1);
  const area = livesAreaBySlug(areaSlug) ?? LIVES_NATIONAL;
  const panelId = 'lives-decade-panel';

  return (
    <div className="lives-instrument">
      <div className="lives-toolbar" role="group" aria-label="Show">
        <div className="lives-toolbar__field">
          <span className="lives-toolbar__label">Area</span>
          <Segmented
            label="Area"
            linkAs={Link}
            value={areaSlug}
            options={LIVES_AREAS.map((entry) => ({
              value: entry.slug,
              label: entry.name,
              href: buildLivesHref(entry.slug, view),
            }))}
          />
        </div>
        {decade ? (
          <label className="lives-toolbar__field">
            <span className="lives-toolbar__label">Decade</span>
            <span className="lives-select">
              <select
                className="lives-select__control"
                value={decade.decade}
                aria-controls={panelId}
                onChange={(event) =>
                  update({ decade: Number(event.currentTarget.value) as LivesViewState['decade'] })
                }
              >
                {bundle.decades.map((entry) => (
                  <option key={entry.decade} value={entry.decade}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <DisclosureCaret />
            </span>
          </label>
        ) : null}
        <div className="lives-toolbar__field lives-toolbar__field--lens">
          <span className="lives-toolbar__label">Emphasize</span>
          <Segmented
            label="Emphasize"
            name="lives-race"
            value={view.race}
            onChange={(next) => update({ race: next as LivesLens })}
            options={LIVES_LENSES.map((lens) => ({ value: lens, label: LIVES_LENS_LABELS[lens] }))}
          />
        </div>
      </div>

      <section className="lives-result" aria-label={bundle.areaName}>
        {decade ? (
          <>
            <LivesClassArcChart
              id="lives-class-arc"
              bundle={bundle}
              emphasis={view.race}
              selectedDecade={decade.decade}
            />

            <p className="lives-result__summary">
              <strong>{bundle.areaName}.</strong> {area.summary}
            </p>

            <LivesPlaceAnchors areaSlug={areaSlug} />

            <p className="lives-sr-only" aria-live="polite">
              Showing the {decade.label}, with {LIVES_LENS_LABELS[view.race]} figures emphasized
            </p>

            <LivesDecadePanel
              id={panelId}
              decade={decade}
              emphasis={view.race}
              disclaimer={bundle.disclaimer}
            />
          </>
        ) : (
          <p className="lives-result__empty">
            No decades are published for {bundle.areaName} in this release.
          </p>
        )}
      </section>
    </div>
  );
}
