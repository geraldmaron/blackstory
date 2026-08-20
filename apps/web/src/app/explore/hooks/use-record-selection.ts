import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { SheetRecord } from '../../../components/map-experience/RecordSheet';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import type { CameraApi } from '../../../lib/map-experience/camera-moves';
import { gradeForConfidence } from '../../../lib/map-experience/evidence-grade';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import type { HistoryEdgeView } from '../../../lib/history/build-history-graph';
import type { CitesEdgeIndex } from '../../../lib/release/build-cites-edge';
import { chaptersCiting } from '../../../lib/release/build-cites-edge';
import {
  buildSheetConnections,
  buildSheetSources,
} from '../../../lib/map-experience/build-sheet-detail';
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
  selectedId: string | undefined,
  setSelectedId: Dispatch<SetStateAction<string | undefined>>,
  /**
   * The ALL-TIME edge slice, not the active decade's. The decade rail filters what the plate
   * draws; it must not filter what a record is documented by (SP-20).
   */
  allTimeEdges: readonly HistoryEdgeView[] = [],
  citesEdge: CitesEdgeIndex = {},
  /** Every feature in the catalog, so a connection can resolve to a record the lens filtered out. */
  allFeatures: readonly ExploreMapFeature[] = sorted,
) {
  /*
   * Connections must resolve against the whole catalog, not the current lens. A record founded by
   * an institution the reader has filtered out is still founded by it, and dropping the row would
   * make the archive look thinner the more precisely someone searched it.
   */
  const featuresById = useMemo(() => {
    const byId = new Map<string, ExploreMapFeature>();
    for (const feature of allFeatures) byId.set(feature.properties.entityId, feature);
    return byId;
  }, [allFeatures]);

  /** Selects a connected record, flying to it when the plate is carrying that pin. */
  const selectById = useCallback(
    (entityId: string) => {
      const feature = featuresById.get(entityId);
      if (feature) {
        const [lng, lat] = feature.geometry.coordinates;
        setSelectedId(entityId);
        camera.flyToRecord({ center: [lng, lat], place: placeLabelFor(feature) });
        return;
      }
      // No pin for it in this catalog: select it anyway so the rail and URL agree, without a
      // camera move to nowhere.
      setSelectedId(entityId);
    },
    [camera, featuresById, setSelectedId],
  );

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
    // A reader who clicks a pin during story mode is asking for the same detail a click gets in
    // Atlas mode. The sheet renders on both a chapter's left and right layouts; when it would sit
    // on the same side as the current chapter card, StoryMode forces every chapter card to the
    // opposite side for as long as the sheet is open (see `.ds-story--sheet-open` in
    // story-mode.css) rather than the sheet giving way — the reader asked to see the record.
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
      sources: buildSheetSources(allTimeEdges, selectedFeature.properties.entityId),
      connections: buildSheetConnections(
        allTimeEdges,
        selectedFeature.properties.entityId,
        (entityId) => {
          const feature = featuresById.get(entityId);
          if (!feature) return undefined;
          return {
            name: feature.properties.displayName,
            kind: feature.properties.kind,
            ...(feature.properties.mapTone ? { mapTone: feature.properties.mapTone } : {}),
            ...(feature.properties.href ? { href: feature.properties.href } : {}),
          };
        },
      ),
      citingChapters: chaptersCiting(citesEdge, selectedFeature.properties.entityId),
    };
  }, [allTimeEdges, citesEdge, featuresById, selectedFeature]);

  return {
    selectedFeature,
    selectedIndex,
    select,
    selectById,
    stepRecord,
    sheetRecord,
  } as const;
}
