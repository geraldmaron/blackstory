'use client';

/**
 * Country (design-direction-v11.md §4.1): an index hands the persistent plate the records its
 * list is showing, and the world holds the right of the screen beside the list. No second map:
 * this is the one `MapStage`.
 *
 * The lights and the list are the same set. Every light is a row on this page; a row with no
 * public point has no light, and the legend says how many. The list is the accessible
 * equivalent, so nothing here is reachable only through the map.
 *
 * Wide screens with a working plate only (`country.css` lays the sheet out from 64rem). Narrower,
 * or without WebGL, the index is the document it always was and no plate is built.
 */
import React, { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import { nationalFieldPatch } from '../../lib/map-experience/national-field';
import { useOptionalMapStage } from './MapStage';
import { OverlapChooser } from './OverlapChooser';

void React;

const WIDE = '(min-width: 64rem)';

export type IndexCountryProps = {
  /** The rows on this page that have a public point. */
  readonly lights: readonly ExploreMapFeature[];
  /** How many rows the page lists, lit or not. */
  readonly listed: number;
};

/** The legend's sentence. Exported for the test. */
export function countryLegend(lit: number, listed: number): string {
  if (listed === 0) return '';
  if (lit === 0) return 'None of the records on this page has a mapped place.';
  const unlit = listed - lit;
  const lights =
    lit === 1 ? '1 light, a record on this page.' : `${lit} lights, each a record on this page.`;
  return unlit === 0
    ? lights
    : `${lights} ${unlit} more ${unlit === 1 ? 'has' : 'have'} no mapped place.`;
}

export function IndexCountry({ lights, listed }: IndexCountryProps) {
  const stage = useOptionalMapStage();
  const router = useRouter();
  const [wide, setWide] = useState(false);
  const available = stage?.mapAvailable ?? false;

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!stage || !wide) return;
    const root = document.documentElement;
    if (!available) {
      // No plate: the sheet goes back to being the whole document (country.css).
      root.dataset.worldOff = '';
      return () => {
        delete root.dataset.worldOff;
      };
    }
    stage.patchData(
      nationalFieldPatch(
        { type: 'FeatureCollection', features: [...lights] },
        { clusteringEnabled: false },
      ),
    );
    stage.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: undefined,
    });
    // The country, in the part of the window the sheet leaves uncovered.
    const land = (mode: 'fly' | 'cut') => {
      const sheet = document.querySelector('.ds-country')?.getBoundingClientRect().right ?? 0;
      stage.flyPreset(
        'national',
        { bounds: US_CONUS_BOUNDS },
        {
          mode,
          // The world's side can be narrower than the country at the plate's national floor.
          zoomFloor: 'fit',
          pitch: 0,
          bearing: 0,
          padding: { top: 72, bottom: 48, left: sheet + 24, right: 24 },
        },
      );
    };
    // Cold, there is no plate to fly yet: land the frame as a cut once it exists.
    let timer: number | undefined;
    if (stage.getMap() === null) {
      let checks = 0;
      timer = window.setInterval(() => {
        checks += 1;
        if (stage.getMap() !== null) land('cut');
        if (stage.getMap() !== null || checks > 150) window.clearInterval(timer);
      }, 200);
    } else {
      land('fly');
    }
    root.dataset.worldOn = '';
    return () => {
      window.clearInterval(timer);
      delete root.dataset.worldOn;
    };
  }, [available, lights, stage, wide]);

  /** Pointing at a row, or focusing it, lifts its light. */
  useEffect(() => {
    if (!stage || !wide || !available) return;
    const lit = new Set(lights.map((light) => light.properties.entityId));
    let current: string | undefined;
    const lift = (event: Event) => {
      const id = (event.target as Element | null)
        ?.closest?.('[data-record-id]')
        ?.getAttribute('data-record-id');
      const next = id && lit.has(id) ? id : undefined;
      if (next === current) return;
      current = next;
      stage.applyViewState({
        selectedState: undefined,
        selectedEdge: undefined,
        selectedEntity: next,
      });
    };
    document.addEventListener('mouseover', lift);
    document.addEventListener('focusin', lift);
    return () => {
      document.removeEventListener('mouseover', lift);
      document.removeEventListener('focusin', lift);
    };
  }, [available, lights, stage, wide]);

  /** A light is a way to its record. */
  useEffect(
    () =>
      stage?.subscribe('select', (entityId) => {
        const light = lights.find((row) => row.properties.entityId === entityId);
        if (light) router.push(light.properties.href);
      }),
    [lights, router, stage],
  );

  const legend = countryLegend(lights.length, listed);
  return (
    <>
      {legend ? (
        <p className="ds-country__legend">
          {legend} Unlit places are not yet researched.{' '}
          <a href="/methodology">How coverage works</a>
        </p>
      ) : null}
      {wide && available ? <OverlapChooser stage={stage} records={lights} /> : null}
    </>
  );
}
