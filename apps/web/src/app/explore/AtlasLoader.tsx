/**
 * Joins the pin collection already on the page to the Explore shell, mounts
 * `AtlasExperience`, and hydrates instruments from `GET /atlas/catalog`.
 *
 * The catalog is ~15 MB (see `atlas-catalog.ts`) and must not ride every
 * `/explore` request as RSC. The plate cannot wait for it either: first paint
 * is the pins `AtlasHome` already built from `getSharedPublicEntities`.
 * Instruments fill in when the catalog arrives — from the CDN on a warm path,
 * from the browser cache on a client-side return to `/explore`.
 *
 * The last catalog is also kept in module memory: navigating away and back within
 * one session re-mounts this component, and a 1 MB re-parse for bytes already in
 * hand is not a cost worth paying. Keyed by URL so a future versioned path cannot
 * serve a stale shape. First-paint pins are never stored as that catalog.
 */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Notice } from '@repo/ui';
import { hasMaintenanceBypassHint } from '../../lib/maintenance/maintenance-bypass-hint';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import { AtlasExperience } from './AtlasExperience';
import {
  ATLAS_CATALOG_PATH,
  assembleExploreViewModel,
  firstPaintCatalog,
  type AtlasCatalogPayload,
  type AtlasShellModel,
} from './explore-view-model-wire';

void React;

let lastCatalog: { readonly url: string; readonly payload: AtlasCatalogPayload } | undefined;

async function fetchAtlasCatalog(url: string, signal: AbortSignal): Promise<AtlasCatalogPayload> {
  if (lastCatalog?.url === url) return lastCatalog.payload;
  // `omit` is the normal path: the catalog is public, CDN-cached, and has no business seeing a
  // cookie. The one exception is an operator holding a maintenance bypass, whose credential has
  // to ride along or the wall answers this fetch with a 503 and Explore comes up empty behind
  // its own bypass. The hint cookie only exists while the wall is up.
  const credentials = hasMaintenanceBypassHint() ? 'same-origin' : 'omit';
  const response = await fetch(url, { signal, credentials });
  if (!response.ok) {
    throw new Error(`atlas catalog ${response.status}`);
  }
  const payload = (await response.json()) as AtlasCatalogPayload;
  if (payload.schemaVersion !== 1 || !payload.source?.featureCollection) {
    throw new Error('atlas catalog: unexpected shape');
  }
  lastCatalog = { url, payload };
  return payload;
}

export type AtlasLoaderProps = {
  readonly shell: AtlasShellModel;
  /** Pin feature collection already in the first HTML document. */
  readonly pins: ExploreMapFeatureCollection;
  /** Overridable for tests and previews; defaults to the live route. */
  readonly catalogUrl?: string;
};

export function AtlasLoader({ shell, pins, catalogUrl = ATLAS_CATALOG_PATH }: AtlasLoaderProps) {
  const firstPaint = useMemo(
    () => firstPaintCatalog(pins, shell.dataSource),
    [pins, shell.dataSource],
  );
  const [catalog, setCatalog] = useState<AtlasCatalogPayload | undefined>(() =>
    lastCatalog?.url === catalogUrl ? lastCatalog.payload : undefined,
  );
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (lastCatalog?.url === catalogUrl) {
      setCatalog(lastCatalog.payload);
      setError(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setError(false);
    fetchAtlasCatalog(catalogUrl, controller.signal).then(
      (payload) => {
        if (!cancelled) {
          setCatalog(payload);
          setError(false);
        }
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [catalogUrl, attempt]);

  const active = catalog ?? firstPaint;
  const hasPins = pins.features.length > 0 || catalog !== undefined;

  if (error && !hasPins) {
    return (
      <div className="ds-atlas ds-atlas--pending" data-atlas-catalog="error">
        <Notice
          tone="error"
          title="Explore could not load its records"
          className="ds-atlas__pending"
        >
          <p>The record catalog did not arrive. Check your connection and try again.</p>
          <p>
            <button
              type="button"
              className="ds-button ds-button--secondary ds-button--compact"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </p>
        </Notice>
      </div>
    );
  }

  return <AtlasExperience initial={assembleExploreViewModel(shell, active)} />;
}
