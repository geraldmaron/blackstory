import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import type { InspectorRecord } from '../../../components/map-experience/RecordInspector';
import type { MapStageHandle } from '../../../components/map-stage/MapStage';
import type { CameraApi } from '../../../lib/map-experience/camera-moves';
import type { ChromeInset } from '../../../lib/map-experience/chrome-padding';
import { evidenceLabel } from '../../../lib/map-experience/evidence-grade';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { withQuery } from '../../../lib/discovery/discovery-arrival';
import {
  resolveExplorePinEntityId,
  subscribeExplorePinSelect,
  type ExplorePinSelectTarget,
} from '../../../lib/map-experience/explore-pin-select';

/**
 * The selected record: its index in the current sort order, the inspector's view of it, and the
 * actions that move the selection. Every one of them (pin click, list row, prev/next, a connection,
 * the home hand-off, a deep link) goes through `selectById`/`select` and so through the one
 * `frameRecord` contract: same zoom rule, same 900ms ease, same padding.
 *
 * `selectedId` itself is owned by the caller, not this hook: the camera needs to know whether the
 * sheet is open (for its padding) without depending on this hook's `camera` input, so the id has
 * to live above both.
 */
export function useRecordSelection(
  stage: MapStageHandle,
  camera: CameraApi,
  /** The chrome visible after the selection opens the inspector (`useAtlasCamera`). */
  selectionPadding: () => ChromeInset,
  sorted: readonly ExploreMapFeature[],
  selectedId: string | undefined,
  setSelectedId: Dispatch<SetStateAction<string | undefined>>,
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

  const frame = useCallback(
    (feature: ExploreMapFeature) => {
      const [lng, lat] = feature.geometry.coordinates;
      camera.frameRecord(
        {
          center: [lng, lat],
          precision: feature.properties.precision,
          place: placeLabelFor(feature),
        },
        { padding: selectionPadding(), trigger: 'reader' },
      );
    },
    [camera, selectionPadding],
  );

  /** Selects a record by id and frames it when the plate carries its point. */
  const selectById = useCallback(
    (entityId: string) => {
      setSelectedId(entityId);
      const feature = featuresById.get(entityId);
      // No point for it in this catalog: select it anyway so the list and URL agree, without a
      // camera move to nowhere.
      if (feature) frame(feature);
    },
    [featuresById, frame, setSelectedId],
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
    (feature: ExploreMapFeature) => {
      setSelectedId(feature.properties.entityId);
      frame(feature);
    },
    [frame, setSelectedId],
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

  /** A pin click is a selection like any other: it opens the inspector and frames the record. */
  useEffect(() => stage.subscribe('select', selectById), [selectById, stage]);

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

  const inspectorRecord = useMemo<InspectorRecord | null>(() => {
    if (!selectedFeature) return null;
    const { properties } = selectedFeature;
    return {
      id: properties.entityId,
      name: properties.displayName,
      kind: properties.kind,
      place: placeLabelFor(selectedFeature),
      story: properties.oneLineStory,
      precision: properties.precision,
      confidenceTier: properties.confidenceTier,
      evidenceLabel: evidenceLabel(properties.confidenceTier, properties.evidenceCount),
      ...(properties.eraBuckets[0] ? { decade: properties.eraBuckets[0] } : {}),
      ...(properties.href ? { href: withQuery(properties.href, placeArrivalQuery) } : {}),
    };
  }, [placeArrivalQuery, selectedFeature]);

  return {
    selectedFeature,
    selectedIndex,
    select,
    selectById,
    stepRecord,
    inspectorRecord,
  } as const;
}
