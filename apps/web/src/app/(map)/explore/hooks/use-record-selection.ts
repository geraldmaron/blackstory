import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { AtlasMode } from '../../../../components/shell/CommandBar';
import type { SheetRecord } from '../../../../components/map-experience/RecordSheet';
import type { MapStageHandle } from '../../MapStage';
import type { CameraApi } from '../../../../lib/map-experience/camera-moves';
import { gradeForConfidence } from '../../../../lib/map-experience/evidence-grade';
import { placeLabelFor } from '../../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../../lib/map-experience/build-explore-map-source';
import { anatomyPrecisionFor, eraFor } from './atlas-feature-helpers';

/**
 * The selected record: its index in the current sort order, the sheet's view of it, and the
 * actions that move the selection (pin click, keyboard step, plate click via `subscribe`).
 *
 * `selectedId` itself is owned by the caller, not this hook: the camera needs to know whether the
 * sheet is open (for its padding) without depending on this hook's `camera` input, so the id has
 * to live above both.
 */
export function useRecordSelection(
  stage: MapStageHandle,
  camera: CameraApi,
  sorted: readonly ExploreMapFeature[],
  mode: AtlasMode,
  selectedId: string | undefined,
  setSelectedId: Dispatch<SetStateAction<string | undefined>>,
) {
  const selectedFeature = useMemo(
    () => sorted.find((feature) => feature.properties.entityId === selectedId) ?? null,
    [selectedId, sorted],
  );

  const selectedIndex = useMemo(
    () => sorted.findIndex((feature) => feature.properties.entityId === selectedId),
    [selectedId, sorted],
  );

  const select = useCallback(
    (feature: ExploreMapFeature, fly = true) => {
      setSelectedId(feature.properties.entityId);
      if (!fly) return;
      const [lng, lat] = feature.geometry.coordinates;
      camera.flyToRecord({ center: [lng, lat], place: placeLabelFor(feature) });
    },
    [camera],
  );

  const stepRecord = useCallback(
    (direction: 1 | -1) => {
      if (sorted.length === 0) return;
      const next =
        selectedIndex < 0 ? 0 : (selectedIndex + direction + sorted.length) % sorted.length;
      const feature = sorted[next];
      if (feature) select(feature);
    },
    [select, selectedIndex, sorted],
  );

  /** Selecting a pin on the plate selects the same record in the rail. */
  useEffect(
    () => stage.subscribe('select', (entityId) => setSelectedId(entityId)),
    [setSelectedId, stage],
  );

  const sheetRecord = useMemo<SheetRecord | null>(() => {
    if (!selectedFeature) return null;
    // Chapter 2 selects a record so the plate can mark it, but the chapter card is what the reader
    // is reading. Opening the sheet over it would put two accounts of the same record on screen.
    if (mode === 'story') return null;
    const grade = gradeForConfidence(selectedFeature.properties.confidenceTier);
    const sources = selectedFeature.properties.evidenceCount;
    return {
      id: selectedFeature.properties.entityId,
      name: selectedFeature.properties.displayName,
      kind: selectedFeature.properties.kind,
      kindLabel: selectedFeature.properties.kindFamily,
      ...(selectedFeature.properties.mapTone
        ? { mapTone: selectedFeature.properties.mapTone }
        : {}),
      place: placeLabelFor(selectedFeature),
      /*
       * The record's own pin, taken from the feature the reader just clicked.
       *
       * Without this the sheet fell through to `RecordAnatomyPanel`'s empty slot and read "Place
       * not pinned" — on a record that is, by definition, a pin on the map it was opened from.
       * Every record reachable from the plate has coordinates; that is what put it there.
       */
      anatomyPlace: {
        lng: selectedFeature.geometry.coordinates[0],
        lat: selectedFeature.geometry.coordinates[1],
        label: selectedFeature.properties.locationLabel ?? placeLabelFor(selectedFeature),
        precision: anatomyPrecisionFor(selectedFeature.properties.precision),
      },
      era: eraFor(selectedFeature),
      story: selectedFeature.properties.oneLineStory,
      precision: selectedFeature.properties.geoPrecisionTier,
      confidenceTier: selectedFeature.properties.confidenceTier,
      evidenceLabel: `${grade ? `Grade ${grade}` : 'Not graded'} · ${sources} ${sources === 1 ? 'source' : 'sources'}`,
      /*
       * The count travels even though the citations do not: the map payload is a count and a
       * confidence tier, not a bibliography (see ExploreMapFeatureProperties). Passing only
       * `sources: []` made the plate state "0 sources / no sources are published for this record
       * yet" directly under its own "Grade A · 1 source", which is both a self-contradiction and
       * false about a record whose page cites a source.
       */
      sourceCount: sources,
      href: selectedFeature.properties.href,
      sources: [],
      connections: [],
    };
  }, [mode, selectedFeature]);

  return {
    selectedFeature,
    selectedIndex,
    select,
    stepRecord,
    sheetRecord,
  } as const;
}
