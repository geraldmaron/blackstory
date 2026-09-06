/**
 * Explore first-paint map: the CONUS board in Web Mercator (state hairlines) plus the pin plate,
 * at the exact frame the live plate opens on (explore-map-underlay.css), so the handoff is a
 * crossfade between two identical maps (repo-27uao). Geography is server HTML. Pan, wheel, and
 * pinch hydrate on. Hidden once MapLibre has painted live geography (`data-plate-ready` on
 * `.ds-map-stage`).
 */
import React, { type ReactNode } from 'react';
import { ExploreMapGestures } from './explore-map-gestures';
import './explore-map-underlay.css';

void React;

type ExploreMapUnderlayProps = {
  readonly children: ReactNode;
};

export function ExploreMapUnderlay({ children }: ExploreMapUnderlayProps) {
  return (
    <div className="ds-explore-underlay">
      <div className="ds-explore-underlay__canvas">
        <div className="ds-explore-underlay__board">
          <div className="ds-explore-underlay__ground" aria-hidden="true" />
          {children}
        </div>
      </div>
      <ExploreMapGestures />
    </div>
  );
}
