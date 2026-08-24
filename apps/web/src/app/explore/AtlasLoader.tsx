/**
 * Fetches the Atlas catalog (`GET /atlas/catalog`), joins it to the shell the page rendered, and
 * mounts `AtlasExperience` with the same `initial` prop it has always taken.
 *
 * The page cannot carry the catalog itself without putting ~15 MB of uncacheable RSC payload on
 * every request (see `atlas-catalog.ts`). So the page renders in tens of KB, the plate is already
 * on screen underneath, and this island fills the instruments in when the catalog arrives — from
 * the CDN on a warm path, from the browser cache on a client-side return to `/`.
 *
 * The last catalog is also kept in module memory: navigating away and back within one session
 * re-mounts this component, and a 1 MB re-parse for bytes already in hand is not a cost worth
 * paying. Keyed by URL so a future versioned path cannot serve a stale shape.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { Notice } from '@repo/ui';
import { hasMaintenanceBypassHint } from '../../lib/maintenance/maintenance-bypass-hint';
import { AtlasExperience } from './AtlasExperience';
import {
  ATLAS_CATALOG_PATH,
  assembleExploreViewModel,
  type AtlasCatalogPayload,
  type AtlasShellModel,
} from './explore-view-model-wire';

void React;

let lastCatalog: { readonly url: string; readonly payload: AtlasCatalogPayload } | undefined;

async function fetchAtlasCatalog(url: string, signal: AbortSignal): Promise<AtlasCatalogPayload> {
  if (lastCatalog?.url === url) return lastCatalog.payload;
  // `omit` is the normal path: the catalog is public, CDN-cached, and has no business seeing a
  // cookie. The one exception is an operator holding a maintenance bypass, whose credential has
  // to ride along or the wall answers this fetch with a 503 and the Atlas comes up empty behind
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
  /** Overridable for tests and previews; defaults to the live route. */
  readonly catalogUrl?: string;
};

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly catalog: AtlasCatalogPayload };

export function AtlasLoader({ shell, catalogUrl = ATLAS_CATALOG_PATH }: AtlasLoaderProps) {
  const [state, setState] = useState<LoadState>(() =>
    lastCatalog?.url === catalogUrl
      ? { status: 'ready', catalog: lastCatalog.payload }
      : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (state.status === 'ready') return;
    const controller = new AbortController();
    let cancelled = false;
    setState({ status: 'loading' });
    fetchAtlasCatalog(catalogUrl, controller.signal).then(
      (catalog) => {
        if (!cancelled) setState({ status: 'ready', catalog });
      },
      () => {
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
    // `attempt` is the retry handle; `state.status` is deliberately not a dependency, or the
    // transition to 'loading' above would re-run this effect and abort its own fetch.
  }, [catalogUrl, attempt]);

  if (state.status === 'ready') {
    return <AtlasExperience initial={assembleExploreViewModel(shell, state.catalog)} />;
  }

  if (state.status === 'error') {
    return (
      <div className="ds-atlas ds-atlas--pending" data-atlas-catalog="error">
        <Notice tone="error" title="The Atlas could not load its records" className="ds-atlas__pending">
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

  return (
    <div className="ds-atlas ds-atlas--pending" data-atlas-catalog="loading">
      <p className="ds-atlas__pending ds-atlas__readout" role="status" aria-live="polite">
        Loading {shell.totalMatched.toLocaleString()} records…
      </p>
    </div>
  );
}
