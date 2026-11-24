/**
 * Mounts the map view on the persistent plate: hands the plate to the reader (pan, zoom, pinch),
 * lifts the paper cover a reading page keeps over it, and loads the map's column and controls.
 * Leaving the view gives both back, so the next page finds the plate as a reading page expects.
 */
'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMapStage } from '../../components/map-stage/MapStage';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import { AtlasPending } from '../explore/AtlasPending';
import { fetchAtlasCatalog } from '../explore/atlas-catalog-fetch';
import type { AtlasShellModel } from '../explore/explore-view-model-wire';

void React;

const AtlasLoader = dynamic(() => import('../explore/AtlasLoader').then((mod) => mod.AtlasLoader), {
  ssr: false,
  // Without this the chunk's download and compile window renders nothing (AtlasPending.tsx).
  loading: () => <AtlasPending />,
});

export type ArchiveMapProps = {
  readonly shell: AtlasShellModel;
  readonly pins: ExploreMapFeatureCollection;
};

export function ArchiveMap({ shell, pins }: ArchiveMapProps) {
  const stage = useMapStage();

  useEffect(() => {
    // Started early; the loader joins the same request and reports any failure itself.
    fetchAtlasCatalog().catch(() => {});
    stage.setBrowseLive(true);
    const root = document.documentElement;
    root.dataset.worldOn = '';
    return () => {
      stage.setBrowseLive(false);
      delete root.dataset.worldOn;
    };
  }, [stage]);

  return (
    <section className="ds-archive-map__view" aria-label="Map of the archive">
      <h1 className="ds-visually-hidden">Archive map</h1>
      <AtlasLoader shell={shell} pins={pins} embedded />
    </section>
  );
}
