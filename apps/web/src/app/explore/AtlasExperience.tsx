/**
 * Explore: the map page, mounted over the persistent `MapStage` canvas.
 *
 * Layout (explore-column.css): a full-canvas map, one flush 380px column on the left that holds
 * filters and list, the list, or the record inspector in place, the decade histogram docked on
 * the map's bottom edge, and the zoom and locate stack bottom-right. Below 768px the column is a
 * bottom sheet (peek, half, full) over a full-screen map. The column header carries the only
 * record count on the page.
 *
 * Deliberately does not: own record data (the view model is built on the server and hydrated here
 * unchanged), change status derivation or evidence grading, or move the camera itself. Every
 * selection (pin, list row, previous/next, deep link, home hand-off, palette) goes through
 * `useRecordSelection` and so through the one `frameRecord` contract.
 *
 * This file is the orchestrator: render plus wiring. State and behavior live in the hooks under
 * `explore/hooks/`.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, FilterButton, Notice } from '@repo/ui';
import { recordsHref } from '../../lib/records/records-query';
import {
  drawableCollection,
  matchExploreCollection,
  recordsQueryFromExplore,
} from '../../lib/discovery/explore-collection';
import {
  normalizePeriod,
  periodIsActive,
  periodIsInvalid,
} from '../../lib/discovery/collection-period';
import {
  collectionIsUnresolved,
  collectionMemberIds,
  collectionStateMessage,
} from '../../lib/discovery/story-collection';
import { CommandBar } from '../../components/shell/CommandBar';
import { CommandPalette } from '../../components/patterns/command-palette/CommandPalette';
import { ShortcutSheet } from '../../components/patterns/ShortcutSheet';
import { CollectionsDrawer } from '../../components/patterns/CollectionsDrawer';
import { EmptyState } from '../../components/patterns/EmptyState';
import { ToastStack, useToasts } from '../../components/patterns/Toast';
import { AnnotationOverlay } from '../../components/map-experience/AnnotationOverlay';
import {
  ExploreColumn,
  sheetHeightFor,
  sheetReachFor,
  type SheetDetent,
} from '../../components/map-experience/ExploreColumn';
import { ExploreFilters } from '../../components/map-experience/ExploreFilters';
import { ExploreRecordList } from '../../components/map-experience/ExploreRecordList';
import { RecordInspector } from '../../components/map-experience/RecordInspector';
import { DecadeBrush } from '../../components/map-experience/DecadeBrush';
import { PlaceControl, type PlaceResolved } from '../../components/map-experience/PlaceControl';
import { MapControls } from '../../components/map-experience/MapControls';
import {
  distanceLabel,
  nearbyFrame,
  nearbySummary,
  type NearbyArea,
} from '../../lib/map-experience/nearby';
import {
  DEFAULT_EXPLORE_RADIUS_ID,
  exploreRadiusPresetById,
  type ExploreRadiusPresetId,
} from '../../lib/map-experience/explore-place-radius';
import { usePhotos } from '../../lib/map-experience/use-photo-index';
import {
  PinPhotoLayer,
  type PinPhotoHoverTarget,
} from '../../components/map-experience/PinPhotoLayer';
import { MIGRATION_CORRIDORS } from '../../lib/map-experience/migration-corridors';
import { clearCollection, unsaveRecord } from '../../lib/collections/store';
import { useMapStage } from '../../components/map-stage/MapStage';
import {
  hydrateExploreViewModel,
  type SerializableExploreViewModel,
} from './explore-view-model-wire';
import { usePanelVisibility } from './hooks/use-panel-visibility';
import { useSavedCollection } from './hooks/use-saved-collection';
import { useLensFilters } from './hooks/use-lens-filters';
import { useMapSync } from './hooks/use-map-sync';
import { usePopulationChoropleth } from './hooks/use-population-choropleth';
import { useAtlasCamera } from './hooks/use-atlas-camera';
import { useReducedMotion } from '../../lib/motion/use-reduced-motion';
import { CAMERA_EASING_SLOW_OUT } from '../../lib/map-experience/camera-presets';
import { useRecordSelection } from './hooks/use-record-selection';
import {
  emitExplorePinSelect,
  resolveExplorePinEntityIds,
} from '../../lib/map-experience/explore-pin-select';
import { usePaletteData } from './hooks/use-palette-data';
import { useReaderActions } from './hooks/use-reader-actions';
import { useLocateMe } from './hooks/use-locate-me';
import { useCommandContext } from './hooks/use-command-context';
import { useExploreUrlSync } from './hooks/use-explore-url-sync';
import { scopedBounds, scopedMixInWords, usePlaceScope } from './hooks/use-place-scope';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import { atlasWalkHref } from '../../lib/place/public-place-path';
import { placeArrivalQuery } from '../../lib/discovery/discovery-arrival';
import { clearPinContinuity, readPinContinuity } from '../../lib/discovery/pin-continuity';
import './atlas.css';

void React;

/** A zoom button step: short, ease-out, a cut under reduced motion. */
const ZOOM_STEP_MS = 250;

/**
 * Basemap symbol layers the "Hide place names" layer chip governs (state/city and street names:
 * `app/map/explore-style.ts`'s `plate-place-city` and `explore-street-label`). Reached through the
 * live map instance rather than a patch field on `MapStageDataPatch`.
 */
const PLACE_LABEL_LAYER_IDS = ['plate-place-city', 'explore-street-label'] as const;

/** The narrow slice of the MapLibre instance the label toggle needs. */
type LabelLayerMap = {
  getLayer(id: string): unknown;
  setLayoutProperty(id: string, name: string, value: unknown): void;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
};

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ATLAS_PHOTOS_URL = '/atlas/photos';
export type AtlasExperienceProps = {
  readonly initial: SerializableExploreViewModel;
  /**
   * Door browse posture (morph-from-home or cold `/explore`): the site header is already on the
   * page, so the room CommandBar is not rendered.
   */
  readonly embedded?: boolean;
};

export function AtlasExperience({ initial, embedded = false }: AtlasExperienceProps) {
  const stage = useMapStage();
  const view = useMemo(() => hydrateExploreViewModel(initial), [initial]);
  const toasts = useToasts();
  const ready = Boolean(view.collectionFacts);

  const {
    mode,
    setMode,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    savedOpen,
    setSavedOpen,
    chromeHidden,
    setChromeHidden,
    phone,
    viewportHeight,
  } = usePanelVisibility();

  /* —— The column's state: filters open or not, and on a phone the sheet's height. —— */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detent, setDetent] = useState<SheetDetent>('peek');
  /** `?find=place` (the old /locate) arrives with the place field ready to type in. */
  const [findPlace] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('find') === 'place',
  );
  useEffect(() => {
    if (findPlace) setFiltersOpen(true);
  }, [findPlace]);

  /**
   * The selection. Owned here, not inside the selection hook: the camera's padding needs to know
   * where the sheet will be without depending on the camera it drives.
   */
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => initial.viewState.selected,
  );
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [overlapIds, setOverlapIds] = useState<readonly string[] | null>(null);

  /** On a phone a selection raises the sheet far enough to read the inspector. */
  const shownDetent: SheetDetent = selectedId !== undefined && detent === 'peek' ? 'half' : detent;
  useEffect(() => {
    if (selectedId !== undefined) setDetent((current) => (current === 'peek' ? 'half' : current));
  }, [selectedId]);

  /**
   * Hands-on map, out-of-the-way chrome. On a phone, a drag, pinch or twist on the map lowers the
   * sheet to its peek; a tap on empty map also closes the inspector.
   */
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  useEffect(() => {
    const lower = () => {
      if (phoneRef.current) setDetent('peek');
    };
    const offInteract = stage.subscribe('interact', lower);
    const offActivate = stage.subscribe('activate', () => {
      if (!phoneRef.current) return;
      lower();
      setSelectedId(undefined);
    });
    return () => {
      offInteract();
      offActivate();
    };
  }, [stage]);

  const { collection, persist, toggleSave } = useSavedCollection(toasts);
  const {
    query,
    era,
    exactKind,
    collectionState,
    collectionMatched,
    stateCode,
    setStateCode,
    kindFamily,
    setKindFamily,
    evidenceFloor,
    setEvidenceFloor,
    period,
    setPeriod,
    topicId,
    setTopicId,
    status,
    layerMode,
    setLayerMode,
    areaFillPermitted,
    layers,
    setLayers,
    sort,
    setSort,
    nearby,
    setNearby,
    distances,
    filtered,
    ghosts,
    nearestMeters,
    sorted,
    kindCounts,
    topicCounts,
    stateOptions,
    decadeBars,
    constraints,
    resetLens,
  } = useLensFilters(view, toasts);

  /* —— The selected place: the map and the list both narrow to exactly its records. —— */
  const {
    placeKey,
    setPlaceKey,
    scope: placeScope,
  } = usePlaceScope(stage, view.allFeatures, initial.viewState.place);
  const inPlace = useCallback(
    (features: readonly ExploreMapFeature[]) =>
      placeScope ? features.filter((f) => placeScope.ids.has(f.properties.entityId)) : features,
    [placeScope],
  );
  const placeFiltered = useMemo(() => inPlace(filtered), [inPlace, filtered]);
  const placeGhosts = useMemo(() => inPlace(ghosts), [inPlace, ghosts]);
  const placeSorted = useMemo(() => inPlace(sorted), [inPlace, sorted]);

  const overlapFeatures = useMemo(
    () =>
      overlapIds
        ? placeSorted.filter((feature) => overlapIds.includes(feature.properties.entityId))
        : null,
    [overlapIds, placeSorted],
  );
  const listed = overlapFeatures ?? placeSorted;

  /** Overlapping records always open a chooser: the list, narrowed to them. */
  useEffect(
    () =>
      stage.subscribe('overlap', (ids) => {
        setSelectedId(undefined);
        setOverlapIds(ids);
        setFiltersOpen(false);
        if (phoneRef.current) setDetent('half');
      }),
    [stage],
  );
  useEffect(() => {
    const clear = () => setOverlapIds(null);
    const offSelect = stage.subscribe('select', clear);
    const offDeselect = stage.subscribe('deselect', clear);
    const offInteract = stage.subscribe('interact', clear);
    return () => {
      offSelect();
      offDeselect();
      offInteract();
    };
  }, [stage]);
  useEffect(() => setOverlapIds(null), [filtered, placeKey]);

  const holdingPlaceArrival = useMemo(
    () =>
      placeArrivalQuery(
        {
          ...(query ? { query } : {}),
          sort: collectionState.sort,
          ...((exactKind ?? kindFamily) ? { kind: exactKind ?? kindFamily! } : {}),
          ...(era !== 'all' ? { era } : {}),
          ...(stateCode ? { state: stateCode } : {}),
          ...(topicId ? { topic: topicId } : {}),
          ...(status ? { status } : {}),
          ...(evidenceFloor === 'A' || evidenceFloor === 'B' || evidenceFloor === 'C'
            ? { evidence: evidenceFloor }
            : {}),
          // The named collection, range and Records layout ride into the record so Return and
          // previous/next restore exactly what the reader left.
          ...(collectionState.collection ? { collection: collectionState.collection } : {}),
          ...(collectionState.periodStart ? { periodStart: collectionState.periodStart } : {}),
          ...(collectionState.periodEnd ? { periodEnd: collectionState.periodEnd } : {}),
          ...(collectionState.includeUndated ? { includeUndated: true } : {}),
          ...(collectionState.layout ? { layout: collectionState.layout } : {}),
        },
        'map',
      ),
    [
      query,
      era,
      exactKind,
      collectionState.collection,
      collectionState.periodStart,
      collectionState.periodEnd,
      collectionState.includeUndated,
      collectionState.layout,
      collectionState.sort,
      evidenceFloor,
      kindFamily,
      stateCode,
      status,
      topicId,
    ],
  );

  useExploreUrlSync(view.viewState, {
    collectionState,
    stateCode,
    kindFamily,
    evidenceFloor,
    topicId,
    status,
    layerMode,
    satellite: layers.satellite,
    lines: layers.routes,
    selectedId,
    placeKey,
  });

  const populationLevels = usePopulationChoropleth(layerMode, view.viewState);

  useMapSync(
    stage,
    view,
    placeFiltered,
    layers,
    layerMode,
    selectedId,
    stateCode,
    populationLevels,
    placeGhosts,
    `${period.start}-${period.end}-${period.includeUndated ? 1 : 0}`,
  );

  // Reapplied on every `styledata`: `patchData` rebuilds the style, which resets layout
  // properties set through the live instance.
  useEffect(() => {
    const map = stage.getMap() as unknown as LabelLayerMap | null;
    if (!map) return;
    const applyLabelVisibility = () => {
      const visibility = layers.labels ? 'visible' : 'none';
      for (const id of PLACE_LABEL_LAYER_IDS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
      }
    };
    applyLabelVisibility();
    map.on('styledata', applyLabelVisibility);
    return () => {
      map.off('styledata', applyLabelVisibility);
    };
  }, [layers.labels, stage]);

  /** Pin photo card, on hover. */
  const [atlasHoverTarget, setAtlasHoverTarget] = useState<PinPhotoHoverTarget | null>(null);
  useEffect(
    () =>
      stage.subscribe('pinHover', (target) =>
        setAtlasHoverTarget(
          target ? { key: target.entityId, name: target.name, rect: target.rect } : null,
        ),
      ),
    [stage],
  );
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAtlasHoverTarget(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const reducedMotion = useReducedMotion();
  const sheetReach = useMemo(
    () =>
      phone
        ? {
            now: sheetReachFor(shownDetent, viewportHeight),
            selected: sheetReachFor(shownDetent === 'peek' ? 'half' : shownDetent, viewportHeight),
          }
        : { now: 0, selected: 0 },
    [phone, shownDetent, viewportHeight],
  );
  const { camera, readout, spotlight, bearing, selectionPadding } = useAtlasCamera(
    stage,
    sheetReach,
    setLayers,
    // A selection, or one about to be restored from the home hand-off, holds the camera.
    // A `?place=` arrival frames its place instead.
    () =>
      selectedIdRef.current !== undefined ||
      readPinContinuity() !== null ||
      initial.viewState.place !== undefined,
  );
  const { selectedFeature, selectedIndex, select, selectById, stepRecord, inspectorRecord } =
    useRecordSelection(
      stage,
      camera,
      selectionPadding,
      listed,
      selectedId,
      setSelectedId,
      view.allFeatures,
      holdingPlaceArrival,
    );

  /**
   * A deep link (`/explore?selected=`, the record page's "Open on the map") frames its record
   * through the same contract as a click, once the plate is live and carries the record's point.
   */
  const deepLinkRef = useRef(initial.viewState.selected);
  const [plateReady, setPlateReady] = useState(false);
  useEffect(() => stage.subscribe('ready', () => setPlateReady(true)), [stage]);
  useEffect(() => {
    const pending = deepLinkRef.current;
    if (!plateReady || pending === undefined) return;
    if (!view.allFeatures.some((feature) => feature.properties.entityId === pending)) return;
    deepLinkRef.current = undefined;
    selectById(pending);
  }, [plateReady, selectById, view.allFeatures]);

  /**
   * A shared `?place=` link frames its place once the plate is live and the place resolves. A tap
   * on a token already moved the camera itself (MapStage), so only the arrival frames here.
   */
  const placeArrivalRef = useRef(initial.viewState.place);
  useEffect(() => {
    if (!plateReady || !placeScope || placeArrivalRef.current !== placeScope.key) return;
    placeArrivalRef.current = undefined;
    const bounds = scopedBounds(placeFiltered);
    if (bounds) camera.frameArea({ kind: 'bounds', bounds, label: placeScope.name });
  }, [camera, placeFiltered, placeScope, plateReady]);

  /**
   * The home hand-off: a pin (or an overlapping group of pins) the reader chose on the Door. A
   * single pin goes through the pin select path, which re-resolves its first-paint id to the real
   * record; overlaps open the chooser, never the first record.
   */
  const continuityRestoredRef = useRef(false);
  useEffect(() => {
    if (continuityRestoredRef.current) return;
    if (initial.viewState.selected) return;
    const saved = readPinContinuity();
    if (!saved) return;
    continuityRestoredRef.current = true;
    clearPinContinuity();
    if (saved.overlap && saved.overlap.length > 0) {
      const ids = resolveExplorePinEntityIds(saved.overlap, view.allFeatures);
      if (ids.length > 0) {
        setOverlapIds(ids);
        if (phoneRef.current) setDetent('half');
      }
      return;
    }
    emitExplorePinSelect({ pinId: saved.entityId, lng: saved.lng, lat: saved.lat });
  }, [initial.viewState.selected, view.allFeatures]);

  const { copy, citationFor } = useReaderActions(toasts);

  /* —— Where: a typed place or the device, with an optional radius. —— */
  const [radiusId, setRadiusId] = useState<ExploreRadiusPresetId>(DEFAULT_EXPLORE_RADIUS_ID);
  const radiusRef = useRef(radiusId);
  radiusRef.current = radiusId;
  const placeWithRadius = useCallback(
    (area: NearbyArea | null) => {
      if (!area) {
        setNearby(null);
        return;
      }
      const preset = exploreRadiusPresetById(radiusRef.current);
      setNearby({
        ...area,
        radiusMeters: preset.meters,
        ...(preset.meters !== null ? { radiusLabel: preset.statusLabel } : {}),
      });
    },
    [setNearby],
  );
  const { locate: nearMe, status: locateStatus } = useLocateMe(toasts, placeWithRadius);

  // Held in refs so the camera and summary run when the located place changes, and only then.
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;
  const nearestMetersRef = useRef(nearestMeters);
  nearestMetersRef.current = nearestMeters;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;
  useEffect(() => {
    if (!nearby) return;
    const { lat, lng } = nearby.center;
    stage.setSearchCenterMarker({
      lat,
      lng,
      label: nearby.source === 'device' ? 'Your location' : nearby.label,
      variant: nearby.source === 'device' ? 'user' : 'place',
    });
    stage.setSearchArea({
      lat,
      lng,
      radiusMeters: nearby.radiusMeters,
      accuracyMeters: nearby.accuracyMeters ?? null,
    });
    return () => {
      stage.clearSearchCenterMarker();
      stage.setSearchArea(null);
    };
  }, [nearby, stage]);
  useEffect(() => {
    if (!nearby) return;
    cameraRef.current.frameArea(nearbyFrame(nearby, filteredRef.current), { trigger: 'reader' });
    toastsRef.current.show({
      id: 'nearby-summary',
      message: nearbySummary(nearby, sortedRef.current.length, nearestMetersRef.current),
    });
  }, [nearby]);

  const distanceLabels = useMemo(() => {
    if (!nearby || !distances) return null;
    const labels = new Map<string, string>();
    for (const [id, meters] of distances) {
      const label = distanceLabel(meters);
      if (label) labels.set(id, label);
    }
    return labels;
  }, [distances, nearby]);

  const onPlaceResolved = useCallback(
    (resolved: PlaceResolved) => {
      if (resolved.kind === 'record') {
        selectById(resolved.entityId);
        return;
      }
      const { target } = resolved;
      const { lat, lng, zoom } = target.viewport;
      if (target.preset === 'state' && target.statePostalCode) {
        setStateCode(target.statePostalCode);
        camera.frameArea(
          { kind: 'center', center: [lng, lat], zoom, label: target.label },
          { trigger: 'reader' },
        );
        return;
      }
      placeWithRadius({
        center: { lat, lng },
        label: target.label,
        source: 'search',
        radiusMeters: null,
      });
    },
    [camera, placeWithRadius, selectById, setStateCode],
  );

  const onRadiusChange = useCallback(
    (id: ExploreRadiusPresetId) => {
      setRadiusId(id);
      if (!nearby) return;
      const preset = exploreRadiusPresetById(id);
      setNearby({
        center: nearby.center,
        label: nearby.label,
        source: nearby.source,
        ...(nearby.accuracyMeters !== undefined ? { accuracyMeters: nearby.accuracyMeters } : {}),
        radiusMeters: preset.meters,
        ...(preset.meters !== null ? { radiusLabel: preset.statusLabel } : {}),
      });
    },
    [nearby, setNearby],
  );

  const { paletteRecords, destinations, paletteStates, featureById } = usePaletteData(
    view,
    stateOptions,
  );
  const commandContext = useCommandContext({
    camera,
    citationFor,
    copy,
    era,
    evidenceFloor,
    kindFamily,
    nearMe,
    resetLens,
    undoLastAction: toasts.runLatestAction,
    selectedFeature,
    selectedId,
    setSelectedId,
    stateCode,
    stepRecord,
    toggleSave,
    setMode,
    setChromeHidden,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    savedOpen,
    setSavedOpen,
  });

  /* Photos are asked for by id (`usePhotos`): the inspected record here, the rows in view in the
     list, the hovered pin in the card. The whole index is never fetched. */
  const inspectorPhotos = usePhotos(
    ATLAS_PHOTOS_URL,
    inspectorRecord && plateReady ? [inspectorRecord.id] : [],
  );
  const inspector = inspectorRecord
    ? {
        ...inspectorRecord,
        ...(inspectorPhotos[inspectorRecord.id]?.url
          ? { photoUrl: inspectorPhotos[inspectorRecord.id]!.url }
          : {}),
      }
    : null;

  /* —— Collection honesty: an unresolved collection or range is stated, never counted. —— */
  const namedCollection = collectionState.collection ?? '';
  const unresolvedCollection =
    namedCollection !== '' && (!view.collection || collectionIsUnresolved(view.collection))
      ? (collectionStateMessage(view.collection ?? { state: 'unavailable', slug: '' }) ??
        'Membership for this collection is unavailable.')
      : undefined;
  const unresolvedRange = periodIsInvalid(
    normalizePeriod({
      start: collectionState.periodStart,
      end: collectionState.periodEnd,
      includeUndated: collectionState.includeUndated,
    }),
  )
    ? 'This decade range cannot be read. Clear it to see records.'
    : undefined;
  const unresolvedScope = unresolvedCollection ?? unresolvedRange;
  const collectionMembers = useMemo(
    () => (view.collection ? collectionMemberIds(view.collection) : undefined),
    [view.collection],
  );
  /** Matching records with a public map point, before any temporary map limit (a radius). */
  const drawable = useMemo(
    () =>
      view.collectionFacts
        ? drawableCollection(
            view.allFeatures,
            matchExploreCollection(view.collectionFacts, collectionState, collectionMembers),
          ).length
        : null,
    [view.collectionFacts, view.allFeatures, collectionState, collectionMembers],
  );
  const unmapped = drawable !== null ? Math.max(0, collectionMatched - drawable) : 0;
  const matchingRecordsHref = recordsHref(recordsQueryFromExplore(collectionState));

  /* —— What the column shows. —— */
  const columnView = inspector ? 'inspector' : filtersOpen ? 'filters' : 'list';
  const count = listed.length;
  const countHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const closeInspector = useCallback(() => {
    setSelectedId(undefined);
    requestAnimationFrame(() => countHeadingRef.current?.focus({ preventScroll: true }));
  }, []);
  const toggleFilters = useCallback(() => {
    setFiltersOpen((open) => {
      if (phoneRef.current) setDetent(open ? 'half' : 'full');
      return !open;
    });
  }, []);

  /**
   * The brushed range on a wide screen is echoed by the dock's own label and clear, so the column
   * does not repeat it. On a phone the brush lives inside Filters, and the echo is its only trace
   * on the list.
   */
  const columnConstraints = phone
    ? constraints
    : constraints.filter((constraint) => constraint.key !== 'period');
  /** The Filters badge counts what the Filters state itself sets: never the header search. */
  const filterCount = columnConstraints.filter(
    (constraint) => constraint.key !== 'q' && constraint.key !== 'decade',
  ).length;

  const echoes = [
    ...(placeKey
      ? [
          {
            key: 'place',
            label: placeScope?.name ?? 'Selected place',
            onClear: () => setPlaceKey(undefined),
          },
        ]
      : []),
    ...(overlapIds
      ? [
          {
            key: 'overlap',
            label: `${(overlapFeatures?.length ?? 0).toLocaleString('en-US')} records at this spot`,
            onClear: () => setOverlapIds(null),
          },
        ]
      : []),
    ...columnConstraints,
  ];

  const header = !ready ? (
    <h2 className="ds-xcol__count">Loading records</h2>
  ) : inspector ? (
    <button type="button" className="ds-xcol__back" onClick={closeInspector}>
      <BackIcon />
      All records
    </button>
  ) : (
    <>
      <h2 className="ds-xcol__count" tabIndex={-1} ref={countHeadingRef} aria-live="polite">
        {count.toLocaleString('en-US')}{' '}
        <span className="ds-xcol__count-unit">{count === 1 ? 'record' : 'records'}</span>
      </h2>
      <FilterButton
        count={filterCount}
        aria-expanded={filtersOpen}
        aria-controls="explore-filters"
        onClick={toggleFilters}
      >
        Filters
      </FilterButton>
    </>
  );

  const brush = (
    <DecadeBrush
      bars={decadeBars}
      range={
        period.start !== '' && period.end !== '' && !periodIsInvalid(period)
          ? { start: Number(period.start), end: Number(period.end) }
          : null
      }
      onChange={(range) => setPeriod(range?.start ?? null, range?.end ?? null)}
    />
  );

  const list = (
    <>
      {unresolvedScope !== undefined ? (
        <p className="ds-xcol__note" role="status">
          {unresolvedScope}
        </p>
      ) : null}
      {placeScope && !overlapIds && listed.length > 0 ? (
        <p className="ds-xcol__note">
          {placeScope.name}. {scopedMixInWords(listed)}.
        </p>
      ) : null}
      <ExploreRecordList
        features={listed}
        period={periodIsActive(period) ? period : undefined}
        selectedId={selectedId}
        onSelect={select}
        photosUrl={plateReady ? ATLAS_PHOTOS_URL : undefined}
        distanceLabels={distanceLabels}
        emptyState={
          <EmptyState
            constraints={{
              ...(evidenceFloor !== 'any' ? { evidenceFloor } : {}),
              ...(era !== 'all' ? { decade: era } : {}),
              ...(stateCode ? { state: stateCode } : {}),
              ...(kindFamily ? { kind: kindFamily } : {}),
              ...(query ? { query } : {}),
            }}
            onReset={resetLens}
          />
        }
      />
      {unmapped > 0 && !overlapIds ? (
        <p className="ds-xcol__note">
          {unmapped.toLocaleString('en-US')} matching{' '}
          {unmapped === 1 ? 'record has' : 'records have'} no place on the map.{' '}
          <a href={matchingRecordsHref}>See them in Records</a>
        </p>
      ) : null}
    </>
  );

  return (
    /* `data-key-scope` is what makes the bare camera, time and record keys legal here and nowhere
       else. `handleKeyStroke` walks up from the keystroke's target looking for it. */
    <div
      className={embedded ? 'ds-atlas ds-atlas--embedded' : 'ds-atlas'}
      inert={!ready}
      aria-busy={!ready}
      data-key-scope="instrument"
      data-chrome={chromeHidden ? 'hidden' : 'shown'}
      data-mode={mode}
      data-detent={phone ? shownDetent : undefined}
      style={
        phone
          ? ({
              '--ds-xcol-detent-h': `${sheetHeightFor(shownDetent, viewportHeight)}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {embedded ? null : (
        <CommandBar
          mode={mode}
          onModeChange={setMode}
          onOpenPalette={() => setPaletteOpen(true)}
          savedCount={collection.records.length}
          onOpenSaved={() => setSavedOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onToggleTheme={commandContext.toggleTheme}
        />
      )}

      {!stage.mapAvailable ? (
        <div className="ds-atlas__notice">
          <Notice tone="warning" title="Map unavailable">
            The map could not start on this device. Every record is still listed beside it and in
            Records.
          </Notice>
        </div>
      ) : null}

      <AnnotationOverlay
        map={
          (stage.getMap() as unknown as React.ComponentProps<typeof AnnotationOverlay>['map']) ??
          null
        }
        corridors={MIGRATION_CORRIDORS}
        visible={layers.routes}
      />

      {spotlight ? (
        <div
          className="ds-atlas__spotlight"
          aria-hidden="true"
          style={
            {
              '--ds-spot-x': `${spotlight.x}px`,
              '--ds-spot-y': `${spotlight.y}px`,
              '--ds-spot-radius': `${spotlight.radius}%`,
            } as React.CSSProperties
          }
        />
      ) : null}

      {chromeHidden || mode !== 'atlas' ? null : (
        <ExploreColumn
          sheet={phone}
          detent={shownDetent}
          onDetentChange={setDetent}
          viewportHeight={viewportHeight}
          view={columnView}
          busy={!ready}
          header={header}
          echoes={
            ready && columnView !== 'inspector' && echoes.length > 0 ? (
              <div className="ds-xcol__echoes" role="group" aria-label="Active filters">
                {echoes.map((echo) => (
                  <Chip
                    key={echo.key}
                    className="ds-xcol__echo"
                    removable
                    label={echo.label}
                    onClick={echo.onClear}
                  >
                    {echo.label}
                  </Chip>
                ))}
                {columnConstraints.length + (placeKey ? 1 : 0) > 1 ? (
                  <Button
                    variant="quiet"
                    className="ds-xcol__clear"
                    onClick={() => {
                      resetLens();
                      setPlaceKey(undefined);
                    }}
                  >
                    Clear all
                  </Button>
                ) : null}
              </div>
            ) : null
          }
        >
          {!ready ? (
            <div className="ds-xcol__loading" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          ) : inspector ? (
            <RecordInspector
              record={inspector}
              {...(selectedIndex >= 0
                ? { position: { index: selectedIndex + 1, total: listed.length } }
                : {})}
              onStep={stepRecord}
            />
          ) : (
            <>
              {filtersOpen ? (
                <div className="ds-xcol__refine" id="explore-filters">
                  <ExploreFilters
                    place={
                      <PlaceControl
                        catalogFeatures={view.allFeatures}
                        onResolved={onPlaceResolved}
                        // The map's locate button is the one locate control; a phone sheet at
                        // full height covers it, so there the field carries the action instead.
                        {...(phone && shownDetent === 'full'
                          ? { onLocate: nearMe, locating: locateStatus === 'locating' }
                          : {})}
                        placed={nearby !== null}
                        radiusId={radiusId}
                        onRadiusChange={onRadiusChange}
                        autoFocus={findPlace}
                      />
                    }
                    {...(phone ? { when: brush } : {})}
                    kindCounts={kindCounts}
                    kindFamily={kindFamily}
                    onKindFamilyChange={setKindFamily}
                    evidenceFloor={evidenceFloor}
                    onEvidenceFloorChange={setEvidenceFloor}
                    topics={topicCounts}
                    topicId={topicId}
                    onTopicChange={setTopicId}
                    sort={sort}
                    onSortChange={setSort}
                    canSortByDistance={nearby !== null}
                    layerMode={layerMode}
                    onLayerModeChange={setLayerMode}
                    areaFillPermitted={areaFillPermitted}
                    layers={layers}
                    onLayerToggle={(layer) =>
                      setLayers((current) => ({ ...current, [layer]: !current[layer] }))
                    }
                  />
                </div>
              ) : null}
              {list}
            </>
          )}
        </ExploreColumn>
      )}

      {!phone && !chromeHidden && mode === 'atlas' ? (
        <div className="ds-xdock" data-ground="ink">
          {brush}
        </div>
      ) : null}

      {mode === 'atlas' && !chromeHidden && stage.mapAvailable ? (
        <MapControls
          onZoom={(delta) => {
            const map = stage.getMap();
            if (!map) return;
            map.easeTo({
              zoom: map.getZoom() + delta,
              duration: reducedMotion ? 0 : ZOOM_STEP_MS,
              easing: CAMERA_EASING_SLOW_OUT,
            } as never);
          }}
          onLocate={nearMe}
          locating={locateStatus === 'locating'}
          located={nearby?.source === 'device'}
          bearing={bearing}
          onResetBearing={() => camera.resetBearing({ trigger: 'reader' })}
        />
      ) : null}

      <p className="ds-atlas__readout ds-visually-hidden" role="status" aria-live="polite">
        {readout}
      </p>

      {/* Hover only: a selected record's photo is in the inspector, and a card over the pin would
          hide the copper mark that says which record is selected. */}
      <PinPhotoLayer target={atlasHoverTarget} photosUrl={ATLAS_PHOTOS_URL} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        records={paletteRecords}
        states={paletteStates}
        destinations={destinations}
        context={commandContext}
        onOpenRecord={(record) => {
          const feature = featureById(record.id);
          if (feature) {
            select(feature);
            setPaletteOpen(false);
            return;
          }
          // Only records with a point in this projection can be selected on the map; the rest
          // still have a page. `kind` picks the route for records that are not mappable.
          setPaletteOpen(false);
          const walk = atlasWalkHref({
            displayName: record.name,
            entityId: record.id,
            ...(record.kind !== undefined ? { kind: record.kind } : {}),
            ...(record.summary !== undefined ? { summary: record.summary } : {}),
          });
          if (walk) window.location.assign(walk);
        }}
        onJumpToState={(paletteState) => {
          const match = stateOptions.find((option) => option.label === paletteState.name);
          if (match) setStateCode(match.value);
          setPaletteOpen(false);
        }}
      />

      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <CollectionsDrawer
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        collection={collection}
        citations={collection.records.map((record) => {
          const feature = featureById(record.id);
          return feature ? citationFor(feature) : '';
        })}
        onOpenRecord={(record) => {
          const feature = featureById(record.id);
          setSavedOpen(false);
          if (feature) {
            select(feature);
            return;
          }
          const walk = atlasWalkHref({
            displayName: record.name,
            kind: record.kind,
            entityId: record.id,
          });
          if (walk) window.location.assign(walk);
        }}
        onRemove={(id) => persist(unsaveRecord(collection, id))}
        onClear={() => persist(clearCollection())}
        onCopyCitations={(text) => copy(text, 'Citations copied.')}
        onCopyGeoJson={(text, unmappable) =>
          copy(
            text,
            unmappable === 0
              ? 'GeoJSON copied.'
              : `GeoJSON copied. ${unmappable} saved ${unmappable === 1 ? 'record has' : 'records have'} no published point.`,
          )
        }
      />

      <ToastStack toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}
