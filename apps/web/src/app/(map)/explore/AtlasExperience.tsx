/**
 * The Atlas — the composition that makes everything P0 to P4 built reachable.
 *
 * Until this module existed, the camera library, the lens, the rail, the histogram, the console,
 * the sheet, the palette and the corridor overlay all typechecked, all had tests, and none of them
 * rendered. This is the package that mounts them over the persistent `MapStage` canvas and retires
 * the v6 chrome they replace (WP-27).
 *
 * What it deliberately does not do:
 *   - own record data: the view model is built on the server and hydrated here unchanged
 *   - change status derivation, evidence grading, or any URL that previously resolved
 *   - consolidate routes. `/` staying a separate surface is WP-25, which is irreversible and
 *     needs its own approval.
 *
 * The camera reaches the plate through `MapStage.getMap()`. That is narrow on purpose: preset
 * framing still goes through `flyPreset` (ADR-017), and this handle exists so `camera-moves.ts`
 * can drive the vocabulary the console and the palette expose.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browsableDestinations } from '../../../lib/nav/destination-registry';
import { findUsStateByPostalCode } from '@repo/domain/map/geography';
import { Notice } from '@repo/ui';
import { CommandBar, type AtlasMode } from '../../../components/shell/CommandBar';
import {
  CommandPalette,
  useCommandPaletteShortcut,
  type PaletteDestination,
  type PaletteRecord,
  type PaletteState,
} from '../../../components/patterns/command-palette/CommandPalette';
import type { CommandContext } from '../../../components/patterns/command-palette/command-registry';
import { ShortcutSheet } from '../../../components/patterns/ShortcutSheet';
import { CollectionsDrawer } from '../../../components/patterns/CollectionsDrawer';
import { EmptyState } from '../../../components/patterns/EmptyState';
import { ToastStack, useToasts } from '../../../components/patterns/Toast';
import { AnnotationOverlay } from '../../../components/map-experience/AnnotationOverlay';
import { CameraConsole } from '../../../components/map-experience/CameraConsole';
import { LensPanel, type LensLayerKey } from '../../../components/map-experience/LensPanel';
import { ResultsRail, type ResultsSort } from '../../../components/map-experience/ResultsRail';
import { RecordSheet, type SheetRecord } from '../../../components/map-experience/RecordSheet';
import type { RecordAnatomyPlace } from '../../../components/patterns/RecordAnatomyPanel';
import { TimePanel } from '../../../components/map-experience/TimePanel';
import { createCamera, type CameraMove } from '../../../lib/map-experience/camera-moves';
import { chromePadding } from '../../../lib/map-experience/chrome-padding';
import { decadeDensityBars } from '../../../lib/map-experience/decade-density';
import { sweep, type SweepHandle } from '../../../lib/map-experience/decade-transition';
import { StoryMode } from '../../../components/story/StoryMode';
import type { StoryChapter } from '../../../lib/story/chapters';
import { pickStoryRecord, type StoryRecordSpotlight } from '../../../lib/story/pick-story-record';
import { pickStoryFact, type StoryFact } from '../../../lib/story/story-facts';
import {
  applyEvidenceFloor,
  gradeForConfidence,
  type EvidenceFloor,
} from '../../../lib/map-experience/evidence-grade';
import { MIGRATION_CORRIDORS } from '../../../lib/map-experience/migration-corridors';
import { prefersReducedMotion } from '../../../lib/map-experience/camera-presets';
import {
  isKnownMapKindFamily,
  type MapKindFamily,
} from '../../../lib/map-experience/kind-encoding';
import { handleKeyStroke, isEscape, resolveEscape } from '../../../lib/keyboard/bindings';
import {
  clearCollection,
  readCollection,
  savedIds as savedIdSet,
  saveRecord as addSaved,
  unsaveRecord,
  writeCollection,
  type SavedCollection,
} from '../../../lib/collections/store';
import { formatCitation } from '../../../lib/citation/format';
import { buildShareHref } from '../../../lib/share/deep-link';
import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';
import { placeLabelFor } from '../../../lib/map-experience/place-label';
import { buildPaletteRecords } from '../../../lib/map-experience/build-palette-records';
import { useMapStage } from '../MapStage';
import {
  hydrateExploreViewModel,
  type SerializableExploreViewModel,
} from './explore-view-model-wire';
import './atlas.css';

void React;

export type AtlasExperienceProps = {
  readonly initial: SerializableExploreViewModel;
};

/** Presence rows shown in the lens. Ten is what fits without the panel becoming a table. */
const PRESENCE_ROWS = 10;

type PanelVisibility = { readonly lens: boolean; readonly results: boolean };

/** Below this the instruments cannot all coexist; see `narrowLayout` and the panel CSS. */
const NARROW_BREAKPOINT = 820;

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < NARROW_BREAKPOINT;
}

function decadeStartYear(bucket: string): number {
  const parsed = Number.parseInt(bucket, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function eraBucketFor(decade: number): string {
  return `${decade}s`;
}

/**
 * The feature's published precision, narrowed to the five values the anatomy panel captions.
 *
 * The map carries `locationPrecision` as an open string because the release vocabulary is wider
 * than what this panel names. Anything outside the five falls back to `city`, which is the
 * coarsest of the point-level options and so cannot overstate how sharp the pin is. Overstating
 * is the only failure mode that matters here: the caption is the archive's claim about what its
 * own dot means.
 */
function anatomyPrecisionFor(precision: string): RecordAnatomyPlace['precision'] {
  switch (precision) {
    case 'county':
    case 'city':
    case 'neighborhood':
    case 'campus':
    case 'institution':
      return precision;
    default:
      return 'city';
  }
}

function eraFor(feature: ExploreMapFeature): string {
  return feature.properties.eraBuckets[0] ?? 'Undated';
}

export function AtlasExperience({ initial }: AtlasExperienceProps) {
  const stage = useMapStage();
  const view = useMemo(() => hydrateExploreViewModel(initial), [initial]);
  const toasts = useToasts();

  /**
   * The Atlas opens in the instrument unless a link asked for the story.
   *
   * Rooms outside the map carry Story in the bar as `/#story`, because there is no surface there
   * to toggle. A fragment rather than a query param: `/` normalizes its query at the edge against
   * the explore allowlist, so a param would be stripped before this ran.
   *
   * Applied after mount, not as the initial value: the server has no fragment, so seeding state
   * from it would render `atlas` on the server and `story` on the client and fail hydration. Read
   * once rather than watched, so a reader who then presses Atlas is not pulled back into the story
   * by a fragment still sitting in the address bar.
   */
  const [mode, setMode] = useState<AtlasMode>('atlas');

  useEffect(() => {
    if (window.location.hash === '#story') setMode('story');
  }, []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  /**
   * Both panels open is the wide default. On a narrow viewport they would cover the plate between
   * them, so the surface opens on the map and the dock chips bring an instrument in when asked.
   * Server-rendered as the wide layout and corrected after mount: `window` has no width on the
   * server, and guessing one would be a hydration mismatch.
   */
  const [panels, setPanels] = useState<PanelVisibility>({ lens: true, results: true });
  const [narrow, setNarrow] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);

  const [stateCode, setStateCode] = useState(initial.viewState.state ?? '');
  const [kindFamily, setKindFamily] = useState<MapKindFamily | null>(
    isKnownMapKindFamily(initial.viewState.filters.kind)
      ? (initial.viewState.filters.kind as MapKindFamily)
      : null,
  );
  const [evidenceFloor, setEvidenceFloor] = useState<EvidenceFloor>('any');
  const [decade, setDecade] = useState<number | null>(null);
  const [layers, setLayers] = useState({ pins: true, routes: false, labels: true });
  const [sort, setSort] = useState<ResultsSort>('oldest');
  const [selectedId, setSelectedId] = useState<string | undefined>(initial.viewState.selected);
  const [collection, setCollection] = useState<SavedCollection>(() => readCollection(null));
  const [readout, setReadout] = useState('');
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; radius: number } | null>(null);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`);
    const sync = () => {
      const isNarrow = query.matches;
      setNarrow(isNarrow);
      // Narrow docks both instruments so the plate is the first thing on screen; widening brings
      // them back. Leaving them docked after a resize strands the reader with an empty map and
      // two chips, which is not what they had before the window changed.
      setPanels(isNarrow ? { lens: false, results: false } : { lens: true, results: true });
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /** Narrow shows one instrument at a time. Two sheets on a phone leave no map between them. */
  const showPanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((current) =>
      isNarrowViewport()
        ? { lens: panel === 'lens', results: panel === 'results' }
        : { ...current, [panel]: true },
    );
  }, []);

  /* ---- saved records ----------------------------------------------------- */

  // Read after mount, never during render: `localStorage` does not exist on the server, and a
  // first client render that disagrees with the server HTML is a hydration mismatch.
  useEffect(() => {
    setCollection(readCollection(globalThis.localStorage));
  }, []);

  const persist = useCallback((next: SavedCollection) => {
    setCollection(next);
    writeCollection(globalThis.localStorage, next);
  }, []);

  /* ---- the lens ---------------------------------------------------------- */

  const filtered = useMemo(() => {
    let features = view.allFeatures;
    if (stateCode) {
      features = features.filter((feature) => feature.properties.statePostalCode === stateCode);
    }
    if (kindFamily) {
      features = features.filter((feature) => feature.properties.kindFamily === kindFamily);
    }
    if (decade !== null) {
      const bucket = eraBucketFor(decade);
      features = features.filter((feature) => feature.properties.eraBuckets.includes(bucket));
    }
    return applyEvidenceFloor(features, evidenceFloor);
  }, [decade, evidenceFloor, kindFamily, stateCode, view.allFeatures]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const left = decadeStartYear(eraFor(a));
      const right = decadeStartYear(eraFor(b));
      if (left !== right) return sort === 'oldest' ? left - right : right - left;
      return a.properties.displayName.localeCompare(b.properties.displayName);
    });
    return rows;
  }, [filtered, sort]);

  const kindCounts = useMemo(() => {
    const counts: Partial<Record<MapKindFamily, number>> = {};
    for (const feature of view.allFeatures) {
      const family = feature.properties.kindFamily as MapKindFamily;
      counts[family] = (counts[family] ?? 0) + 1;
    }
    return counts;
  }, [view.allFeatures]);

  const presence = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const feature of view.allFeatures) {
      const code = feature.properties.statePostalCode;
      if (!code) continue;
      const entry = counts.get(code) ?? {
        name: feature.properties.stateName ?? findUsStateByPostalCode(code)?.name ?? code,
        count: 0,
      };
      entry.count += 1;
      counts.set(code, entry);
    }
    return [...counts.entries()]
      .map(([postalCode, entry]) => ({ postalCode, name: entry.name, count: entry.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, PRESENCE_ROWS);
  }, [view.allFeatures]);

  const stateOptions = useMemo(
    () =>
      view.facetOptions.state
        .filter((option) => option.value !== 'all')
        .map((option) => ({ value: option.value, label: option.label })),
    [view.facetOptions.state],
  );

  const decadeBars = useMemo(
    () =>
      decadeDensityBars(
        view.entityDecades.map((entry) => ({
          decade: decadeStartYear(entry.decade),
          count: entry.count,
        })),
      ),
    [view.entityDecades],
  );

  /* ---- the map ----------------------------------------------------------- */

  /** Keep the plate showing exactly what the rail shows. One lens, two renderings of it. */
  useEffect(() => {
    stage.patchData({
      featureCollection: { type: 'FeatureCollection', features: layers.pins ? filtered : [] },
      jurisdictionAreaFeatures: [],
      layerMode: view.viewState.layerMode,
      densityLevels: view.densityLevels,
      historyEdgesEnabled: false,
      historyEdgeCollection: view.edgeLineCollection,
    });
  }, [
    filtered,
    layers.pins,
    stage,
    view.densityLevels,
    view.edgeLineCollection,
    view.viewState.layerMode,
  ]);

  useEffect(() => {
    stage.applyViewState({
      selectedState: stateCode || undefined,
      selectedEdge: undefined,
      selectedEntity: selectedId,
    });
  }, [selectedId, stage, stateCode]);

  /* ---- the camera -------------------------------------------------------- */

  const paddingRef = useRef({ lens: true, results: true, sheet: false });
  paddingRef.current = {
    lens: panels.lens && !chromeHidden,
    results: panels.results && !chromeHidden,
    sheet: selectedId !== undefined,
  };

  const camera = useMemo(
    () =>
      createCamera({
        // The map arrives asynchronously, so the library holds the accessor rather than an
        // instance. A no-op stand-in keeps every move safe to call before the canvas is alive.
        map: {
          flyTo: (options) => stage.getMap()?.flyTo(options as never),
          easeTo: (options) => stage.getMap()?.easeTo(options as never),
          fitBounds: (bounds, options) =>
            stage.getMap()?.fitBounds(bounds as never, options as never),
          getZoom: () => stage.getMap()?.getZoom() ?? 3.6,
          getBearing: () => stage.getMap()?.getBearing() ?? 0,
          getPitch: () => stage.getMap()?.getPitch() ?? 0,
          getCenter: () => stage.getMap()?.getCenter() ?? { lng: -96.5, lat: 38.6 },
          stop: () => stage.getMap()?.stop(),
        },
        padding: () =>
          chromePadding({
            viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
            viewportHeight: typeof window === 'undefined' ? 900 : window.innerHeight,
            lensOpen: paddingRef.current.lens,
            resultsOpen: paddingRef.current.results,
            sheetOpen: paddingRef.current.sheet,
          }),
        reducedMotion: prefersReducedMotion,
        announce: setReadout,
        setRoutes: (visible) => setLayers((current) => ({ ...current, routes: visible })),
        setSpotlight: (target) => {
          if (!target) {
            setSpotlight(null);
            return;
          }
          const point = stage.getMap() as unknown as {
            project?: (lngLat: readonly [number, number]) => { x: number; y: number };
          } | null;
          const projected = point?.project?.(target.center) ?? null;
          setSpotlight(
            projected
              ? { x: projected.x, y: projected.y, radius: target.radiusPercent }
              : { x: 0.5, y: 0.5, radius: target.radiusPercent },
          );
        },
      }),
    [stage],
  );

  /** The camera readout clears itself, so a stale "Orbit" does not sit under the map forever. */
  useEffect(() => {
    if (!readout) return;
    const timer = setTimeout(() => setReadout(''), 2400);
    return () => clearTimeout(timer);
  }, [readout]);

  /** The establishing shot. Start wide, then go deep (§4.2 rule 2), once the canvas has size. */
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !stage.mapAvailable) return;
    framed.current = true;
    const timer = setTimeout(() => camera.wide({ trigger: 'ambient' }), 400);
    return () => clearTimeout(timer);
  }, [camera, stage.mapAvailable]);

  /* ---- selection --------------------------------------------------------- */

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
  useEffect(() => stage.subscribe('select', (entityId) => setSelectedId(entityId)), [stage]);

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
      sources: [],
      connections: [],
    };
  }, [mode, selectedFeature]);

  /* ---- actions ----------------------------------------------------------- */

  const copy = useCallback(
    (text: string, message: string) => {
      void navigator.clipboard
        ?.writeText(text)
        .then(() => toasts.show({ id: `copy-${Date.now()}`, message }))
        .catch(() =>
          toasts.show({
            id: `copy-fail-${Date.now()}`,
            message: 'Your browser blocked the copy. Select the text and copy it by hand.',
          }),
        );
    },
    [toasts],
  );

  const citationFor = useCallback((feature: ExploreMapFeature): string => {
    const grade = gradeForConfidence(feature.properties.confidenceTier);
    return formatCitation({
      name: feature.properties.displayName,
      place: placeLabelFor(feature),
      era: eraFor(feature),
      grade: grade ?? 'not graded',
      sourceCount: feature.properties.evidenceCount,
      url: `https://blackstory.org${feature.properties.href}`,
      accessed: new Date(),
    });
  }, []);

  const toggleSave = useCallback(
    (feature: ExploreMapFeature) => {
      const id = feature.properties.entityId;
      const wasSaved = collection.records.some((record) => record.id === id);
      const [lng, lat] = feature.geometry.coordinates;
      const next = wasSaved
        ? unsaveRecord(collection, id)
        : addSaved(collection, {
            id,
            name: feature.properties.displayName,
            kind: feature.properties.kind,
            place: placeLabelFor(feature),
            era: eraFor(feature),
            grade: gradeForConfidence(feature.properties.confidenceTier),
            href: feature.properties.href,
            lng,
            lat,
            savedAt: new Date().toISOString(),
          });
      persist(next);
      toasts.show({
        id: `save-${id}-${Date.now()}`,
        message: wasSaved ? 'Removed from saved.' : 'Saved.',
        action: { label: 'Undo', run: () => persist(collection) },
      });
    },
    [collection, persist, toasts],
  );

  const resetLens = useCallback(() => {
    const previous = { stateCode, kindFamily, evidenceFloor, decade };
    setStateCode('');
    setKindFamily(null);
    setEvidenceFloor('any');
    setDecade(null);
    toasts.show({
      id: `reset-${Date.now()}`,
      message: 'Lens reset.',
      action: {
        label: 'Undo',
        run: () => {
          setStateCode(previous.stateCode);
          setKindFamily(previous.kindFamily);
          setEvidenceFloor(previous.evidenceFloor);
          setDecade(previous.decade);
        },
      },
    });
  }, [decade, evidenceFloor, kindFamily, stateCode, toasts]);

  const nearMe = useCallback(() => {
    if (!navigator.geolocation) {
      toasts.show({
        id: `near-${Date.now()}`,
        message: 'This browser cannot share a location. Pick a state in the lens instead.',
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        camera.push({
          target: [position.coords.longitude, position.coords.latitude],
          label: 'your location',
        });
      },
      () =>
        toasts.show({
          id: `near-denied-${Date.now()}`,
          message: 'Location was not shared. Pick a state in the lens instead.',
        }),
    );
  }, [camera, toasts]);

  const runMove = useCallback(
    (move: CameraMove) => {
      const options = { trigger: 'reader' as const };
      if (move === 'wide') camera.wide(options);
      else if (move === 'push') camera.push(options);
      else if (move === 'orbit') camera.orbit(options);
      else if (move === 'tilt') camera.tilt(options);
      else if (move === 'spotlight') camera.spotlight(options);
      else if (move === 'trace')
        camera.trace({ ...options, corridorCount: MIGRATION_CORRIDORS.length });
    },
    [camera],
  );

  /* ---- the keyboard ------------------------------------------------------ */

  const router = useRouter();

  const commandContext = useMemo<CommandContext>(
    () => ({
      focusSearch: () => setPaletteOpen(true),
      nearMe,
      resetLens,
      camera,
      stepRecord,
      saveRecord: () => {
        if (selectedFeature) toggleSave(selectedFeature);
      },
      copyCitation: () => {
        if (selectedFeature) copy(citationFor(selectedFeature), 'Citation copied.');
      },
      copyShareLink: () => {
        // ADR-017: the link carries the lens, never the live pan/zoom. `buildShareHref` is the
        // only builder allowed to produce it, and its own test proves no viewport key survives.
        const href = buildShareHref(
          {
            ...(selectedId ? { record: selectedId } : {}),
            ...(stateCode ? { state: stateCode } : {}),
            ...(decade !== null ? { era: eraBucketFor(decade) } : {}),
            ...(evidenceFloor !== 'any' ? { grade: evidenceFloor } : {}),
            ...(kindFamily ? { kind: kindFamily } : {}),
          },
          window.location.pathname,
        );
        copy(`${window.location.origin}${href}`, 'Share link copied.');
      },
      closeSheet: () => setSelectedId(undefined),
      setMode,
      openLibrary: () => router.push('/library'),
      togglePlayback: () => {},
      toggleTheme: () => {
        const root = document.documentElement;
        root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      },
      toggleDensity: () => {
        const root = document.documentElement;
        root.dataset.density = root.dataset.density === 'compact' ? 'comfortable' : 'compact';
      },
      toggleMotion: () => {
        const root = document.documentElement;
        root.dataset.motion = root.dataset.motion === 'calm' ? 'cinematic' : 'calm';
      },
      toggleChrome: () => setChromeHidden((hidden) => !hidden),
    }),
    [
      camera,
      citationFor,
      copy,
      decade,
      evidenceFloor,
      kindFamily,
      nearMe,
      resetLens,
      router,
      selectedFeature,
      selectedId,
      stateCode,
      stepRecord,
      toggleSave,
    ],
  );

  useCommandPaletteShortcut(() => setPaletteOpen(true));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEscape(event)) {
        const layer = resolveEscape({
          palette: paletteOpen,
          overlay: shortcutsOpen || savedOpen,
          spotlight: camera.isSpotlit(),
          sheet: selectedId !== undefined,
        });
        if (!layer) return;
        event.preventDefault();
        if (layer === 'palette') setPaletteOpen(false);
        else if (layer === 'overlay') {
          setShortcutsOpen(false);
          setSavedOpen(false);
        } else if (layer === 'spotlight') camera.spotlight({ trigger: 'reader' });
        else setSelectedId(undefined);
        return;
      }

      if (paletteOpen) return;
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (handleKeyStroke(event, commandContext, { target: event.target })) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [camera, commandContext, paletteOpen, savedOpen, selectedId, shortcutsOpen]);

  /* ---- palette data ------------------------------------------------------ */

  /**
   * Name and place only, until repo-92n2.35 widened this to topic, kind, era and summary. The
   * build moved to `build-palette-records.ts` so what the index carries has a test over real
   * release features — a subject missing from the index is a subject the palette cannot find,
   * and that is not a fact a component test can establish.
   */
  const paletteRecords = useMemo<readonly PaletteRecord[]>(
    () => buildPaletteRecords(view.allFeatures),
    [view.allFeatures],
  );

  /**
   * Every site destination, from the destination registry the breadcrumb, the library hub and the
   * footer also read (SP-15). The bar carries two modes instead of fourteen links, so this is what
   * keeps Data, Law, Banned books, Memorial, Methodology, Corrections, Errata and Submit reachable
   * from the Atlas.
   *
   * It was built from `PRIMARY_NAV` + `OVERFLOW_NAV`, which is why the palette went on offering
   * "History" after that route became a redirect. Reading the registry means a route is in the Go
   * section because it exists, and `destination-registry.test.ts` fails when one is missing.
   */
  const destinations = useMemo<readonly PaletteDestination[]>(
    () =>
      browsableDestinations().map((destination) => ({
        href: destination.path,
        label: destination.label,
      })),
    [],
  );

  const paletteStates = useMemo<readonly PaletteState[]>(
    () => stateOptions.map((option) => ({ name: option.label })),
    [stateOptions],
  );

  const featureById = useCallback(
    (id: string) => view.allFeatures.find((feature) => feature.properties.entityId === id) ?? null,
    [view.allFeatures],
  );

  /* ---- story ------------------------------------------------------------- */

  /**
   * The running decade sweep, if a chapter asked for one. Held in a ref rather than state because
   * the next chapter has to cancel it during its own handler, and a state read there would see the
   * previous render's value and leave two sweeps stepping the histogram against each other.
   */
  const sweepRef = useRef<SweepHandle | null>(null);

  const stopSweep = useCallback(() => {
    sweepRef.current?.cancel();
    sweepRef.current = null;
  }, []);

  /**
   * The record chapter 2 shows and the fact chapter 3 shows, drawn once per mount rather than per
   * render. Re-rolling on every render would change the card under the reader mid-sentence, and
   * re-rolling on every chapter change would mean scrolling back up produced a different archive.
   *
   * `Math.random` is read here, in an effect-free initialiser, rather than inside the pure pickers,
   * so both remain reproducible in a test.
   */
  const [storyRoll] = useState(() => ({ record: Math.random(), fact: Math.random() }));
  const storyRecord = useMemo<StoryRecordSpotlight | null>(
    () => pickStoryRecord(view.allFeatures, storyRoll.record),
    [storyRoll.record, view.allFeatures],
  );
  const storyFact = useMemo<StoryFact>(() => pickStoryFact(storyRoll.fact), [storyRoll.fact]);

  /**
   * Runs a chapter's beats: camera, spotlight, corridors, decade sweep, and the one record chapter
   * 2 is about (design-direction-v9-atlas.md §6). Story mode was a toggle that hid the instruments
   * and put nothing in their place — `StoryMode.tsx` and `chapters.ts` both existed and neither had
   * a caller.
   *
   * A chapter naming a record goes through `camera.flyToRecord`, not a raw `flyTo`, so the dignity
   * gate still governs how close the plate is allowed to get. A chapter's own camera spec is a view
   * of the country rather than of anyone, so it flies directly.
   */
  const runChapter = useCallback(
    (chapter: StoryChapter) => {
      stopSweep();
      camera.cancel();

      const focus =
        chapter.focusRandomRecord && storyRecord ? featureById(storyRecord.entityId) : null;
      setSelectedId(focus?.properties.entityId);

      // A rotating fact names its own geography. Without this the plate would keep whatever the
      // previous chapter framed while the card talked about somewhere else entirely.
      const factCamera = chapter.rotatingFact ? storyFact.camera : null;

      if (focus) {
        const [lng, lat] = focus.geometry.coordinates;
        camera.flyToRecord(
          { center: [lng, lat], place: placeLabelFor(focus) },
          { trigger: 'ambient' },
        );
      } else if (factCamera) {
        camera.flyToRecord(
          { center: [factCamera.center[0], factCamera.center[1]], place: storyFact.placeLabel },
          { trigger: 'ambient' },
        );
      } else {
        stage.getMap()?.flyTo({
          center: chapter.camera.center,
          zoom: chapter.camera.zoom,
          pitch: chapter.camera.pitch,
          bearing: chapter.camera.bearing,
          duration: prefersReducedMotion() ? 0 : 1600,
        } as never);
      }

      setLayers((current) => ({ ...current, routes: chapter.routes === true }));

      if (chapter.spotlightRadiusPercent !== undefined) {
        camera.spotlight({
          center: chapter.camera.center,
          radiusPercent: chapter.spotlightRadiusPercent,
          trigger: 'ambient',
        });
      } else {
        setSpotlight(null);
      }

      if (chapter.sweep && decadeBars.length > 0) {
        const first = decadeBars[0];
        const last = decadeBars[decadeBars.length - 1];
        if (first && last) {
          sweepRef.current = sweep({
            from: first.decade,
            to: last.decade,
            onDecade: setDecade,
            // The sweep ends on the last decade, which would leave the plate filtered to it. All
            // time is what the chapter is arguing for, so the histogram returns there.
            onDone: () => setDecade(null),
            reducedMotion: prefersReducedMotion(),
          });
        }
      } else {
        setDecade(null);
      }
    },
    [camera, decadeBars, featureById, stage, stopSweep, storyFact, storyRecord],
  );

  /**
   * Leaving the story must not strand its beats on the Atlas. A spotlight mask, a corridor layer or
   * a stepping histogram left running would read as the map having broken, not as the story having
   * ended.
   */
  useEffect(() => {
    if (mode === 'story') return;
    stopSweep();
    setSpotlight(null);
    // The corridor chapter turns the routes layer on. Left on, it draws six arcs and their labels
    // across an Atlas the reader never asked to annotate, and the lens toggle reads as already-on.
    setLayers((current) => (current.routes ? { ...current, routes: false } : current));
  }, [mode, stopSweep]);

  useEffect(() => stopSweep, [stopSweep]);

  /* ---- render ------------------------------------------------------------ */

  const savedSet = useMemo(() => savedIdSet(collection), [collection]);
  const showLens = panels.lens && !chromeHidden && mode === 'atlas';
  const showResults =
    panels.results && !chromeHidden && mode === 'atlas' && selectedId === undefined;

  return (
    <div className="ds-atlas" data-chrome={chromeHidden ? 'hidden' : 'shown'} data-mode={mode}>
      <CommandBar
        mode={mode}
        onModeChange={setMode}
        onOpenPalette={() => setPaletteOpen(true)}
        recordCount={view.allFeatures.length}
        savedCount={collection.records.length}
        onOpenSaved={() => setSavedOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onToggleTheme={commandContext.toggleTheme}
      />

      {!stage.mapAvailable ? (
        <div className="ds-atlas__notice">
          <Notice tone="warning" title="Map unavailable">
            The map canvas could not start on this device. Every record is still listed and
            searchable in the rail and the palette.
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

      <StoryMode
        active={mode === 'story'}
        onChapter={runChapter}
        onOpenAtlas={() => setMode('atlas')}
        onNearMe={nearMe}
        reducedMotion={prefersReducedMotion()}
        recordSpotlight={storyRecord ?? undefined}
        fact={storyFact}
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

      {showLens ? (
        <LensPanel
          matched={filtered.length}
          total={view.allFeatures.length}
          stateOptions={stateOptions}
          state={stateCode}
          onStateChange={setStateCode}
          onNearMe={nearMe}
          kindCounts={kindCounts}
          kindFamily={kindFamily}
          onKindFamilyChange={setKindFamily}
          evidenceFloor={evidenceFloor}
          onEvidenceFloorChange={setEvidenceFloor}
          layers={layers}
          onLayerToggle={(layer: LensLayerKey) =>
            setLayers((current) => ({ ...current, [layer]: !current[layer] }))
          }
          presence={presence}
          onReset={resetLens}
          onHide={() => setPanels((current) => ({ ...current, lens: false }))}
        />
      ) : null}

      {showResults ? (
        <ResultsRail
          features={sorted}
          total={view.allFeatures.length}
          selectedId={selectedId}
          onSelect={select}
          sort={sort}
          onSortChange={setSort}
          savedIds={savedSet}
          onToggleSave={toggleSave}
          onHide={() => setPanels((current) => ({ ...current, results: false }))}
          emptyState={
            <EmptyState
              constraints={{
                ...(evidenceFloor !== 'any' ? { evidenceFloor } : {}),
                ...(decade !== null ? { decade: eraBucketFor(decade) } : {}),
                ...(stateCode ? { state: stateCode } : {}),
                ...(kindFamily ? { kind: kindFamily } : {}),
              }}
              onReset={resetLens}
            />
          }
        />
      ) : null}

      {mode === 'atlas' && !chromeHidden ? (
        <>
          <TimePanel
            bars={decadeBars}
            decade={decade}
            onDecadeChange={setDecade}
            totalRecords={view.allFeatures.length}
          />
          {narrow ? null : (
            <CameraConsole
              onMove={runMove}
              onZoom={(delta) => {
                const map = stage.getMap();
                if (!map) return;
                map.easeTo({ zoom: map.getZoom() + delta, duration: 260 } as never);
              }}
              activeRecord={selectedFeature?.properties ?? null}
              spotlit={camera.isSpotlit()}
            />
          )}
        </>
      ) : null}

      {(!panels.lens || !panels.results) && !chromeHidden ? (
        <div className="ds-atlas__dock">
          {!panels.lens ? (
            <button type="button" onClick={() => showPanel('lens')}>
              Lens
            </button>
          ) : null}
          {!panels.results ? (
            <button type="button" onClick={() => showPanel('results')}>
              Records
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="ds-atlas__readout" role="status" aria-live="polite">
        {readout}
      </p>

      <RecordSheet
        record={sheetRecord}
        onClose={() => setSelectedId(undefined)}
        {...(selectedIndex >= 0
          ? { position: { index: selectedIndex + 1, total: sorted.length } }
          : {})}
        onStep={stepRecord}
        onFlyToPlace={() => {
          if (selectedFeature) select(selectedFeature);
        }}
        onSave={() => {
          if (selectedFeature) toggleSave(selectedFeature);
        }}
        saved={selectedId ? savedSet.has(selectedId) : false}
        onCite={() => {
          if (selectedFeature) copy(citationFor(selectedFeature), 'Citation copied.');
        }}
        onShare={commandContext.copyShareLink}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        records={paletteRecords}
        states={paletteStates}
        destinations={destinations}
        context={commandContext}
        onOpenRecord={(record, fly) => {
          const feature = featureById(record.id);
          if (feature) {
            select(feature, fly);
            setPaletteOpen(false);
            return;
          }
          // The palette searches the whole index, but only records with a map feature in the
          // current projection can be selected on the Atlas. Without this the click was
          // swallowed: the palette closed and nothing opened, which reads as a broken search.
          // Every record has a page even when it has no pin, so fall through to it.
          setPaletteOpen(false);
          window.location.assign(`/entity/${record.id}`);
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
          // Same as the palette: a saved record whose pin is not in this projection still opens.
          window.location.assign(`/entity/${record.id}`);
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
