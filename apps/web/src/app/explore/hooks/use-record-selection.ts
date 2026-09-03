import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import type { SheetRecord } from '../../../components/map-experience/RecordSheet';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import type { CameraApi } from '../../../lib/map-experience/camera-moves';
import { gradeForConfidence } from '../../../lib/map-experience/evidence-grade';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import type { HistoryEdgeView } from '../../../lib/history/build-history-graph';
import type { CitesEdgeIndex } from '../../../lib/release/build-cites-edge';
import { storiesCiting } from '../../../lib/release/build-cites-edge';
import {
  buildSheetConnections,
  buildSheetSources,
} from '../../../lib/map-experience/build-sheet-detail';
import { buildVisitHandoffFromMapFeature } from '../../../lib/geography/visit-handoff';
import { withQuery } from '../../../lib/discovery/discovery-arrival';
import { anatomyPrecisionFor, eraFor } from './atlas-feature-helpers';
import {
  resolveExplorePinEntityId,
  subscribeExplorePinSelect,
  type ExplorePinSelectTarget,
} from '../../../lib/map-experience/explore-pin-select';

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
  /** Place arrival query (`from=map` + DiscoveryState filters). Empty when unnarrowed. */
  placeArrivalQuery = '',
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

  const selectedFeature = useMemo(() => {
    if (selectedId === undefined) return null;
    return (
      sorted.find((feature) => feature.properties.entityId === selectedId) ??
      featuresById.get(selectedId) ??
      null
    );
  }, [featuresById, selectedId, sorted]);

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
    [camera, setSelectedId],
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

  /** Pin clicks stay on the plate and open the record sheet. Place pages are a sheet CTA. */
  useEffect(
    () =>
      stage.subscribe('select', (entityId) => {
        setSelectedId(entityId);
      }),
    [setSelectedId, stage],
  );

  useEffect(
    () =>
      stage.subscribe('deselect', () => {
        setSelectedId(undefined);
      }),
    [setSelectedId, stage],
  );

  const lastUnderlayPinRef = useRef<ExplorePinSelectTarget | null>(null);

  useEffect(
    () =>
      subscribeExplorePinSelect((target) => {
        lastUnderlayPinRef.current = target;
        const entityId = resolveExplorePinEntityId(target, allFeatures);
        if (entityId) selectById(entityId);
      }),
    [allFeatures, selectById],
  );

  // First-paint discs carry `pin-N`. When the catalog replaces that source, keep the
  // open sheet on the same geography instead of dropping a now-unknown id.
  useEffect(() => {
    if (selectedId === undefined || !selectedId.startsWith('pin-')) return;
    if (featuresById.has(selectedId)) return;
    const target = lastUnderlayPinRef.current;
    if (!target) return;
    const entityId = resolveExplorePinEntityId(target, allFeatures);
    if (entityId) selectById(entityId);
  }, [allFeatures, featuresById, selectById, selectedId]);

  const sheetRecord = useMemo<SheetRecord | null>(() => {
    if (!selectedFeature) return null;
    // A reader who clicks a pin during story mode is asking for the same detail a click gets in
    // Explore mode. The sheet renders on both a chapter's left and right layouts; when it would sit
    // on the same side as the current chapter card, StoryMode forces every chapter card to the
    // opposite side for as long as the sheet is open (see `.ds-story--sheet-open` in
    // story-mode.css) rather than the sheet giving way — the reader asked to see the record.
    const grade = gradeForConfidence(selectedFeature.properties.confidenceTier);
    const sources = selectedFeature.properties.evidenceCount;
    return {
      id: selectedFeature.properties.entityId,
      name: selectedFeature.properties.displayName,
      kind: selectedFeature.properties.kind,
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
        label: placeLabelFor(selectedFeature),
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
      ...(selectedFeature.properties.href
        ? { href: withQuery(selectedFeature.properties.href, placeArrivalQuery) }
        : {}),
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
            ...(feature.properties.href
              ? { href: withQuery(feature.properties.href, placeArrivalQuery) }
              : {}),
          };
        },
      ),
      citingStories: storiesCiting(citesEdge, selectedFeature.properties.entityId),
      visitInput: buildVisitHandoffFromMapFeature({
        displayName: selectedFeature.properties.displayName,
        locationPrecision: selectedFeature.properties.precision,
        kind: selectedFeature.properties.kind,
        lat: selectedFeature.geometry.coordinates[1],
        lng: selectedFeature.geometry.coordinates[0],
        ...(selectedFeature.properties.locationLabel !== undefined
          ? { locationLabel: selectedFeature.properties.locationLabel }
          : {}),
        ...(selectedFeature.properties.jurisdictionLabel !== undefined
          ? { jurisdictionLabel: selectedFeature.properties.jurisdictionLabel }
          : {}),
        ...(selectedFeature.properties.status !== undefined
          ? { status: selectedFeature.properties.status }
          : {}),
        ...(selectedFeature.properties.livingStatus !== undefined
          ? { livingStatus: selectedFeature.properties.livingStatus }
          : {}),
        ...(selectedFeature.properties.sensitivityClass !== undefined
          ? { sensitivityClass: selectedFeature.properties.sensitivityClass }
          : {}),
        ...(selectedFeature.properties.visitClaims !== undefined
          ? { claims: selectedFeature.properties.visitClaims }
          : {}),
      }),
    };
  }, [allTimeEdges, citesEdge, featuresById, placeArrivalQuery, selectedFeature]);

  return {
    selectedFeature,
    selectedIndex,
    select,
    selectById,
    stepRecord,
    sheetRecord,
  } as const;
}
