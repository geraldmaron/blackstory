/**
 * What `/explore` shows while the `AtlasLoader` chunk downloads and compiles.
 *
 * `dynamic(..., { ssr: false })` renders its `loading` option in place of the component until the
 * chunk arrives, and with no option that is nothing. `loading.tsx` cannot cover this window: it is
 * the Suspense fallback for the server render, and that has already finished by now. The chunk is
 * the whole atlas (panels, MapLibre stage, view model), so the gap is long on a cold dev server.
 *
 * The blocks sit where the real instruments mount (Filters left, Records right, When along the
 * bottom; one peek sheet on a phone) so nothing jumps when they replace it. Never a spinner: the
 * shimmer is `.ds-sk` from `components/patterns/skeleton.css`.
 */
import React from 'react';
import '../../components/patterns/skeleton.css';
import './atlas-pending.css';

void React;

export function AtlasPending() {
  return (
    <div className="ds-atlas-pending" role="status" aria-live="polite">
      <span className="ds-visually-hidden">Loading the map…</span>
      <div className="ds-atlas-pending__panel ds-atlas-pending__panel--lens" aria-hidden="true">
        <span className="ds-sk ds-sk--title ds-sk--w-40" />
        <span className="ds-sk ds-sk--row ds-sk--w-full" />
        <span className="ds-sk ds-sk--row ds-sk--w-full" />
        <span className="ds-sk ds-sk--text ds-sk--w-80" />
        <span className="ds-sk ds-sk--text ds-sk--w-60" />
      </div>
      <div className="ds-atlas-pending__panel ds-atlas-pending__panel--results" aria-hidden="true">
        <span className="ds-sk ds-sk--title ds-sk--w-40" />
        <span className="ds-sk ds-sk--row ds-sk--w-full" />
        <span className="ds-sk ds-sk--row ds-sk--w-full" />
        <span className="ds-sk ds-sk--row ds-sk--w-full" />
        <span className="ds-sk ds-sk--row ds-sk--w-full" />
      </div>
      <div className="ds-atlas-pending__panel ds-atlas-pending__panel--time" aria-hidden="true">
        <span className="ds-sk ds-sk--text ds-sk--w-40" />
        <span className="ds-sk ds-sk--row ds-sk--w-full" />
      </div>
    </div>
  );
}
