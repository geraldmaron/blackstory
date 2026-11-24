/**
 * Joins the pin collection already on the page to the Explore shell, mounts
 * `AtlasExperience`, and hydrates instruments from `GET /atlas/catalog`.
 *
 * The catalog is ~15 MB (see `atlas-catalog.ts`) and must not ride every
 * `/explore` request as RSC. The plate cannot wait for it either: first paint
 * is the Door pin field (or morph-from-home plate), then instruments fill in when
 * the catalog arrives (`atlas-catalog-fetch.ts`, which the Door starts before this
 * chunk has even loaded). First-paint pins are never stored as that catalog.
 */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@repo/ui';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import { AtlasExperience } from './AtlasExperience';
import { CommandBar } from '../../components/shell/CommandBar';
import { recordsHref } from '../../lib/records/records-query';
import { recordsQueryFromExplore } from '../../lib/discovery/explore-collection';
import { cachedAtlasCatalog, fetchAtlasCatalog } from './atlas-catalog-fetch';
import {
  ATLAS_CATALOG_PATH,
  assembleExploreViewModel,
  firstPaintCatalog,
  type AtlasCatalogPayload,
  type AtlasShellModel,
} from './explore-view-model-wire';

void React;

export type AtlasLoaderProps = {
  readonly shell: AtlasShellModel;
  /** Pin feature collection already in the first HTML document. */
  readonly pins: ExploreMapFeatureCollection;
  /** Overridable for tests and previews; defaults to the live route. */
  readonly catalogUrl?: string;
  /**
   * Door browse (morph or cold `/explore`): skip the second CommandBar (SiteShell already
   * has one). Exit back to the journey is owned by DoorImmersive.
   */
  readonly embedded?: boolean;
};

export function AtlasLoader({
  shell,
  pins,
  catalogUrl = ATLAS_CATALOG_PATH,
  embedded = false,
}: AtlasLoaderProps) {
  const firstPaint = useMemo(
    () => firstPaintCatalog(pins, shell.dataSource),
    [pins, shell.dataSource],
  );
  const [catalog, setCatalog] = useState<AtlasCatalogPayload | undefined>(() =>
    cachedAtlasCatalog(catalogUrl),
  );
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let canceled = false;
    setError(false);
    fetchAtlasCatalog(catalogUrl).then(
      (payload) => {
        if (!canceled) {
          setCatalog(payload);
          setError(false);
        }
      },
      () => {
        if (!canceled) setError(true);
      },
    );
    return () => {
      canceled = true;
    };
  }, [catalogUrl, attempt]);

  const active = catalog ?? firstPaint;
  const matchingRecordsHref = recordsHref(recordsQueryFromExplore(shell.viewState));

  if (error && !catalog?.collectionFacts) {
    // The column, in its error state: the map stays visible beside it.
    return (
      <div className="ds-atlas" data-atlas-catalog="error">
        {/* Embedded, the site header is already on the page; alone, this branch needs its own. */}
        {embedded ? null : <CommandBar />}
        <aside className="ds-xcol" aria-label="Records on the map">
          <div className="ds-xcol__head">
            <h2 className="ds-xcol__count">Records did not load</h2>
          </div>
          <div className="ds-xcol__error" role="alert">
            <p>
              The list of records for the map did not arrive. Check your connection and try again.
            </p>
            <p>
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>{' '}
              <Button variant="quiet" href={matchingRecordsHref}>
                Open the same records in Records
              </Button>
            </p>
          </div>
        </aside>
      </div>
    );
  }

  // Until the catalog arrives the column shows its own loading rows (AtlasExperience).
  return <AtlasExperience initial={assembleExploreViewModel(shell, active)} embedded={embedded} />;
}
