/**
 * Explore first-paint map: Albers US locator (state hairlines) plus the pin plate.
 * Geography is server HTML. Pan, wheel, and pinch hydrate on. Hidden once MapLibre
 * has painted live geography (`data-plate-ready` on `.ds-map-stage`).
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
