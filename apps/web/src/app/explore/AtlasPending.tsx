/**
 * What `/explore` shows while the `AtlasLoader` chunk downloads and compiles.
 *
 * `dynamic(..., { ssr: false })` renders its `loading` option in place of the component until the
 * chunk arrives, and with no option that is nothing. `loading.tsx` cannot cover this window: it is
 * the Suspense fallback for the server render, and that has already finished by now.
 *
 * The placeholder is the column itself, in its loading state, so nothing jumps when the real one
 * replaces it. Never a spinner.
 */
import React from 'react';
import '../../components/map-experience/explore-column.css';

void React;

export function AtlasPending() {
  return (
    <div className="ds-atlas" role="status" aria-live="polite">
      <aside className="ds-xcol ds-xcol--pending" aria-label="Records on the map" aria-busy="true">
        <div className="ds-xcol__head">
          <h2 className="ds-xcol__count">Loading records</h2>
        </div>
        <div className="ds-xcol__loading" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </aside>
    </div>
  );
}
