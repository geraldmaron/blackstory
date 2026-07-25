/**
 * Cinematic Map Backdrop adoption for the `/entity/[id]` place-context locator
 * (`docs/ui/patterns-cinematic-map.md` §1, §2, §10; bead repo-4v3a.6). Rest -> Engaged only
 * (no Invite) — unlike home/explore, this map is a supplementary locator sitting inside other
 * record content, not the primary surface, so it starts Rest (natural scroll, locked, dimmed)
 * and requires an explicit "View interactive map" tap rather than auto-engaging on mount.
 *
 * Unlike `MapStage`'s full-viewport persistent plate, `EntityLocationMap` is a small
 * contained-in-flow figure. `cinematic-map.css`'s scrim/rail/lock rules assume the full-bleed
 * shape (`position: fixed`), so this module scopes overrides to `.ds-entity-location-map-surface`
 * in `entity-page.css` rather than editing the shared pattern CSS.
 */
'use client';

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import '../patterns/cinematic-map/cinematic-map.css';
import {
  CinematicMapProvider,
  useCinematicMap,
  type CinematicMapDriver,
} from '../patterns/cinematic-map/CinematicMapProvider';
import { CinematicScrim } from '../patterns/cinematic-map/CinematicScrim';
import { ExploreMapControl } from '../patterns/cinematic-map/ExploreMapControl';
import { CinematicMapClose } from '../patterns/cinematic-map/CinematicMapClose';
import { EntityLocationMapLazy } from './EntityLocationMapLazy';
import type { EntityLocationMapControls, EntityLocationMapProps } from './EntityLocationMap';

export type EntityLocationCinematicMapProps = Omit<
  EntityLocationMapProps,
  'selected' | 'locked' | 'onMapReady'
> & {
  /** Passed to `useCinematicMap().select(entityId)` on engage, kept consistent with the shared
   * driver contract even though this plate only ever has the one feature to select. */
  readonly entityId: string;
};

/** Keeps `useCinematicMap()`'s selection in sync with Engaged/Rest transitions. A real effect
 * (not a render-time call) so `select`/`deselect` never fire during render. */
function useEntitySelectionSync(engaged: boolean, entityId: string): void {
  const { select, deselect } = useCinematicMap();
  useEffect(() => {
    if (engaged) {
      select(entityId);
    } else {
      deselect();
    }
  }, [engaged, entityId, select, deselect]);
}

function EntityLocationMapSurface({
  entityId,
  controlsRef,
  ...mapProps
}: EntityLocationCinematicMapProps & {
  readonly controlsRef: MutableRefObject<EntityLocationMapControls | null>;
}) {
  const { state } = useCinematicMap();
  const engaged = state === 'engaged';
  useEntitySelectionSync(engaged, entityId);

  const handleMapReady = useCallback(
    (controls: EntityLocationMapControls) => {
      controlsRef.current = controls;
    },
    [controlsRef],
  );

  return (
    <div className="ds-entity-location-map-surface" data-cinematic-state={state}>
      <div className="ds-map-stage">
        <EntityLocationMapLazy
          {...mapProps}
          selected={engaged}
          locked={!engaged}
          onMapReady={handleMapReady}
        />
      </div>
      <CinematicScrim />
      <div className="ds-cinematic-rail">
        <ExploreMapControl label="View interactive map" />
        <CinematicMapClose label="Close interactive map" />
      </div>
    </div>
  );
}

export function EntityLocationCinematicMap(props: EntityLocationCinematicMapProps) {
  const controlsRef = useRef<EntityLocationMapControls | null>(null);
  const driverRef = useRef<CinematicMapDriver>({
    select: () => {},
    deselect: () => {},
    flyTo: () => controlsRef.current?.recenter(),
  });

  return (
    <CinematicMapProvider driver={driverRef.current} homePreset="point">
      <EntityLocationMapSurface {...props} controlsRef={controlsRef} />
    </CinematicMapProvider>
  );
}
