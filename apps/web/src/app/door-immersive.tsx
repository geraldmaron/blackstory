/**
 * The Door: the national map uncovered across the viewport and a column docked bottom-left
 * (beneath the map on a phone) that leads with one real record: its name, its plate with credit
 * and one claim with its source and grade. A callout on the map points at the same record.
 *
 * One visit rolls the records on the server so SSR and hydrate match.
 *
 * THE MAP IS EXPLORE'S MAP, AND IT IS THE ONLY MAP HERE. The Door hands the persistent `MapStage`
 * the same national-field patch Explore rests on (`nationalFieldPatch`) and holds it national.
 *
 * The walk is the decade histogram, a stepper, not a scroll story: decade by decade the map fills
 * with the records documented up to that decade and the card brings up one record from it, its
 * pin called out on the map (the map and the plate always show the same record). The histogram is
 * also a slider, so a reader can scrub across time. The page itself does not scroll, so the wheel
 * is never hijacked. Arrow keys step inside the card and Escape returns to the opening.
 *
 * The camera is framed against the Door's map window (`.ds-door__window`): the part of the plate
 * the dock does not cover (right of the column on a desktop, above the dock on a phone), re-framed
 * whenever that window changes (door-field-frame.ts). The callout lives inside the same window, so
 * it can never sit on the headline.
 *
 * Browse is a posture of this surface, not a second product: the walk morphs away and the
 * Explore instruments mount over the same plate. `/explore` stays the deep-link URL.
 *
 * Pins with public hrefs stay clickable: a marker on the live plate goes through the stage's own
 * `select` and place-token paths and hands off to browse.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { buttonClassName } from '@repo/ui';
import { savePinContinuity } from '../lib/discovery/pin-continuity';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import type { StateDensityLevel } from '../lib/map-experience/density';
import { recordMarkFor } from '../lib/map-experience/geo-precision';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { nationalFieldPatch } from '../lib/map-experience/national-field';
import { earliestDecadeFor } from '../lib/map-experience/decade-transition';
import { HeroHeadlineMorph } from '../components/story/HeroHeadlineMorph';
import type { DecadeBar, DoorJourneyRecord } from './door-decade-walk';
import {
  PinPhotoLayer,
  type PinPhotoHoverTarget,
} from '../components/map-experience/PinPhotoLayer';
import { useMapStage } from '../components/map-stage/MapStage';
import {
  announceMapBrowseEntered,
  announceMapBrowseExited,
  MAP_BROWSE_ENTER_EVENT,
  MAP_BROWSE_EXIT_EVENT,
} from '../lib/nav/map-browse';
import { AtlasPending } from './explore/AtlasPending';
import { fetchAtlasCatalog } from './explore/atlas-catalog-fetch';
import type { AtlasShellModel } from './explore/explore-view-model-wire';
import {
  DOOR_ORBIT_CENTER,
  doorDrillPadding,
  doorFramePadding,
  doorOrbitZoom,
  lightThroughDecade,
  sameDoorFrameBox,
  type DoorFrameBox,
} from './door-field-frame';
import { DoorSpotlightCallout } from './door-spotlight-callout';
import { DoorWalkCard } from './door-walk';
import { DoorTimeRail, timeRailText } from './door-time-rail';
import { DOOR_TOUR_EVENT, type DoorTourTarget } from './door-tour-scroll';
import { tourZoom } from './door-tour';
import { placeDrillZoom } from '../lib/map-experience/place-map';
import { MAP_MAX_ZOOM } from '../lib/map-experience/camera-presets';
import { readAsDocuments } from '../lib/map-experience/world-prefs';

void React;

const AtlasLoader = dynamic(() => import('./explore/AtlasLoader').then((mod) => mod.AtlasLoader), {
  ssr: false,
  // Without this the chunk's download/compile window renders nothing (see AtlasPending.tsx).
  loading: () => <AtlasPending />,
});

/** Starts the shared catalog fetch early; `AtlasLoader` joins it and reports any failure. */
function prefetchAtlasCatalog(): void {
  fetchAtlasCatalog().catch(() => {});
}

/** Morph duration before instruments mount; matches `--ds-door-browse-ms` in door-home.css. */
const DOOR_BROWSE_MORPH_MS = 320;

/** The opening's one sentence: what is here, not how to use the page. */
const DOOR_OPEN_LINE =
  'People, places and events in Black American history, each pinned where its sources put it.';

function boxOf(element: HTMLElement | null): DoorFrameBox | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** The boxes a frame is computed against; a frame is only recomputed when one of them moves. */
type DoorFrameBoxes = {
  readonly window: DoorFrameBox | null;
  readonly plate: DoorFrameBox | null;
};

function sameDoorFrameBoxes(a: DoorFrameBoxes, b: DoorFrameBoxes): boolean {
  return sameDoorFrameBox(a.window, b.window) && sameDoorFrameBox(a.plate, b.plate);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** What the field reports about the plate: nothing yet, this mount's frame landed, or no plate. */
type DoorPlateState = 'pending' | 'live' | 'unavailable';

/** A plate that has not painted after this long gets the plain list of places instead. */
const PLATE_STALL_MS = 12_000;
/** How many states the no-map list names. */
const FALLBACK_PLACE_COUNT = 8;

/** The record the opening leads with is kept for the browser session, so a reload keeps it. */
const OPENING_STORAGE_KEY = 'bs:door-opening';

/** A stored record is used only when it is whole and its pin is still on this plate. */
function restoreOpening(
  pins: ExploreMapFeatureCollection,
  choices: readonly DoorJourneyRecord[],
): DoorJourneyRecord | null {
  try {
    const raw = window.sessionStorage.getItem(OPENING_STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as DoorJourneyRecord;
    const ok =
      typeof record.name === 'string' &&
      typeof record.href === 'string' &&
      record.href.startsWith('/') &&
      typeof record.pinId === 'string' &&
      Array.isArray(record.lngLat) &&
      record.lngLat.length === 2 &&
      typeof record.claim === 'object' &&
      record.claim !== null;
    if (!ok) return null;
    const here = choices.find((choice) => choice.href === record.href);
    if (here) return here;
    const pin = pins.features.find((feature) => feature.properties.entityId === record.pinId);
    const [lng, lat] = pin?.geometry.coordinates ?? [];
    return lng === record.lngLat[0] && lat === record.lngLat[1] ? record : null;
  } catch {
    return null;
  }
}

function pinOpening(record: DoorJourneyRecord): void {
  try {
    window.sessionStorage.setItem(OPENING_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage is a convenience: without it the opening is simply rolled per visit.
  }
}

export type DoorImmersiveProps = {
  readonly pins: ExploreMapFeatureCollection;
  /** Per-state presence tiers, so the plate opens on the same tint Explore does. */
  readonly densityLevels: readonly StateDensityLevel[];
  /** Request-scoped Explore shell so browse morph can mount Atlas without a second navigation. */
  readonly browseShell: AtlasShellModel;
  /** The record the opening leads with (door-decade-walk.ts), or nothing on an empty release. */
  readonly opening: DoorJourneyRecord | null;
  /** What "Another record" cycles through: the opening first, all of one eligibility. */
  readonly openingChoices: readonly DoorJourneyRecord[];
  /** The lead story the opening's one primary action reads, or nothing without a story. */
  readonly story: { readonly title: string; readonly slug: string } | null;
  /** The walk: one record per decade, oldest first. */
  readonly stops: readonly DoorJourneyRecord[];
  /** The register's decade histogram on a true time scale, and its prose caption. */
  readonly bars: readonly DecadeBar[];
  readonly barsCaption: string;
  /**
   * Cold `/explore` (and deep links): land already in browse posture, the same embedded atlas as
   * a morph from `/`, without the cinematic delay.
   */
  readonly initialBrowse?: boolean;
};

export function DoorImmersive({
  pins,
  densityLevels,
  browseShell,
  opening: serverOpening,
  openingChoices,
  story,
  stops,
  bars,
  barsCaption,
  initialBrowse = false,
}: DoorImmersiveProps) {
  // The server's roll first (so hydration matches); a record pinned for this session replaces it
  // right after mount, and the first visit pins the one it was shown.
  const [opening, setOpening] = useState(serverOpening);
  useEffect(() => {
    const kept = restoreOpening(pins, openingChoices);
    if (kept) setOpening(kept);
    else if (serverOpening) pinOpening(serverOpening);
    // Mount only.
  }, []);
  const journeyRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);
  const walkHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const browseHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const browseReturnFocusRef = useRef<HTMLElement | null>(null);
  const browseFocusPendingRef = useRef(false);
  /** The map window: the part of the plate the dock leaves uncovered (door-home.css). */
  const windowRef = useRef<HTMLDivElement | null>(null);

  const stage = useMapStage();
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const router = useRouter();
  const pathname = usePathname() || '/';

  const [browseMode, setBrowseMode] = useState(initialBrowse);
  const [browseMounted, setBrowseMounted] = useState(initialBrowse);
  const browseModeRef = useRef(initialBrowse);
  browseModeRef.current = browseMode;
  const browseMorphTimerRef = useRef<number | null>(null);
  const initialBrowseArmedRef = useRef(false);

  /** 0 is the opening; 1..n are the walk's decades, oldest first. */
  const [step, setStep] = useState(0);
  /** Read by the camera, which must not re-bind (and re-frame) on every step. */
  const stepRef = useRef(step);
  stepRef.current = step;
  const stepFocusPendingRef = useRef(false);

  // The hidden walk is inert. Move focus only for an actual mode transition, never steal it on a
  // cold page load, and preserve the original entry control. Entering browse lands on the map's
  // heading once the instruments have mounted; the way back is the header's Map tab or Back.
  useEffect(() => {
    if (!browseFocusPendingRef.current) return;
    if (browseMode) {
      if (!browseMounted) return;
      browseFocusPendingRef.current = false;
      browseHeadingRef.current?.focus({ preventScroll: true });
    } else {
      browseFocusPendingRef.current = false;
      const origin = browseReturnFocusRef.current;
      const target =
        origin?.isConnected && !origin.closest('[inert]') ? origin : journeyRef.current;
      target?.focus({ preventScroll: true });
    }
  }, [browseMode, browseMounted]);

  // A step the reader chose moves focus to what replaced the control they pressed.
  useEffect(() => {
    if (!stepFocusPendingRef.current) return;
    stepFocusPendingRef.current = false;
    (step === 0 ? startRef.current : walkHeadingRef.current)?.focus({ preventScroll: true });
  }, [step]);

  /** The time rail on the opening: the decade the world is lit through, or null for all time. */
  const [railDecade, setRailDecade] = useState<number | null>(null);
  /** What the plate is patched with: the rail's value, settled, so a drag is one patch. */
  const [railSettled, setRailSettled] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setRailSettled(railDecade), 140);
    return () => window.clearTimeout(timer);
  }, [railDecade]);
  const railOn = step === 0 && railDecade !== null;

  /** The record on screen: the opening's, or the current decade's; none while the rail is set. */
  const current = railOn ? null : step === 0 ? opening : (stops[step - 1] ?? null);
  /** The decade the walk has filled the map to; null on the opening (the whole archive). */
  const shownDecade = step === 0 ? null : (stops[step - 1]?.decade ?? null);

  /** What the plate shows this frame: the whole field, or the archive as of the shown decade. */
  const sweptPins = useMemo<ExploreMapFeatureCollection>(() => {
    // The rail keeps undated records lit (they are counted, never dropped); the walk's own
    // sweep below shows only what it can place in a decade.
    if (step === 0) {
      if (railSettled === null) return pins;
      return {
        ...pins,
        features: pins.features.filter((feature) =>
          lightThroughDecade(earliestDecadeFor(feature), railSettled),
        ),
      };
    }
    if (shownDecade === null) return pins;
    return {
      ...pins,
      features: pins.features.filter((feature) => {
        const decade = earliestDecadeFor(feature);
        return decade !== null && decade <= shownDecade;
      }),
    };
  }, [pins, railSettled, shownDecade, step]);

  /** The rail's counts at its current position, before the plate has caught up. */
  const railCounts = useMemo(() => {
    let lit = 0;
    let undated = 0;
    for (const feature of pins.features) {
      const decade = earliestDecadeFor(feature);
      if (!lightThroughDecade(decade, railDecade)) continue;
      lit += 1;
      if (decade === null) undated += 1;
    }
    return { lit, undated };
  }, [pins, railDecade]);

  /** Cold `/explore`: arm Live gestures and Door browse chrome before the first paint settles. */
  useEffect(() => {
    if (!initialBrowse || initialBrowseArmedRef.current) return;
    initialBrowseArmedRef.current = true;
    prefetchAtlasCatalog();
    stage.setDoorBrowseLive(true);
    announceMapBrowseEntered();
    const state = window.history.state as { doorBrowse?: number } | null;
    if (!state || state.doorBrowse !== 1) {
      window.history.replaceState(
        { doorBrowse: 1 },
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, [initialBrowse, stage]);

  /** Whether entering browse pushed the `/explore` entry over this page's own `/`. */
  const enteredByPushRef = useRef(false);

  /**
   * Leaves browse. `traversed`: the browser already stepped back over the pushed `/explore` entry
   * (its own Back or a swipe), so the URL is already right.
   */
  const leaveBrowse = useCallback(
    (traversed: boolean) => {
      if (!browseModeRef.current) {
        // Still sync URL if a cold explore left the address bar armed.
        if (pathname.startsWith('/explore') || window.location.pathname.startsWith('/explore')) {
          router.replace('/');
        }
        return;
      }
      if (browseMorphTimerRef.current !== null) {
        window.clearTimeout(browseMorphTimerRef.current);
        browseMorphTimerRef.current = null;
      }
      browseFocusPendingRef.current = true;
      setBrowseMounted(false);
      setBrowseMode(false);
      browseModeRef.current = false;
      stage.setDoorBrowseLive(false);
      announceMapBrowseExited();
      /*
       * Morph enter uses history.pushState so the Door tree stays mounted; Next's pathname can
       * still be `/` while the address bar reads `/explore`. Cold `/explore` is a real route.
       * Exit must restore the opening URL and, when Next owns the explore page, leave that route.
       */
      const pushedState =
        (window.history.state as { doorBrowse?: number } | null)?.doorBrowse === 1;
      const steppingBack = !traversed && enteredByPushRef.current && pushedState;
      if (traversed) {
        // Nothing to do to the URL: the traversal already put `/` back.
      } else if (steppingBack) {
        // Leaving steps back over the pushed entry rather than stacking a second `/` on top
        // (which made the browser's Back a no-op).
        window.history.back();
      } else if (
        pathname.startsWith('/explore') ||
        window.location.pathname.startsWith('/explore')
      ) {
        router.replace('/', { scroll: false });
      } else if (pushedState) {
        window.history.replaceState(null, '', '/');
      }
      enteredByPushRef.current = false;
    },
    [pathname, router, stage],
  );
  const exitBrowse = useCallback(() => leaveBrowse(false), [leaveBrowse]);

  /**
   * Enters browse. `push`: add the `/explore` history entry. A browser Forward onto that entry
   * already shows `/explore`, so it re-enters without pushing another.
   */
  const startBrowse = useCallback(
    (push: boolean, place?: string) => {
      if (browseModeRef.current) return;
      // The list waits on the catalog: start it now, not after the morph and the Atlas chunk.
      prefetchAtlasCatalog();
      browseReturnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      browseFocusPendingRef.current = true;
      browseModeRef.current = true;
      setBrowseMode(true);
      stage.setDoorBrowseLive(true);
      announceMapBrowseEntered();
      // Either way the page's `/` entry sits directly behind this one, so leaving steps back.
      enteredByPushRef.current = true;
      if (push)
        window.history.pushState(
          { doorBrowse: 1 },
          '',
          place ? `/explore?place=${encodeURIComponent(place)}` : '/explore',
        );
      const delay = prefersReducedMotion() ? 0 : DOOR_BROWSE_MORPH_MS;
      if (browseMorphTimerRef.current !== null) {
        window.clearTimeout(browseMorphTimerRef.current);
      }
      browseMorphTimerRef.current = window.setTimeout(() => {
        browseMorphTimerRef.current = null;
        setBrowseMounted(true);
      }, delay);
    },
    [stage],
  );
  const enterBrowse = useCallback(() => startBrowse(true), [startBrowse]);

  const enterBrowseRef = useRef(enterBrowse);
  const exitBrowseRef = useRef(exitBrowse);
  const leaveBrowseRef = useRef(leaveBrowse);
  const startBrowseRef = useRef(startBrowse);
  enterBrowseRef.current = enterBrowse;
  exitBrowseRef.current = exitBrowse;
  leaveBrowseRef.current = leaveBrowse;
  startBrowseRef.current = startBrowse;

  /*
   * Listeners must not rebind when enter/exit identities change: a cleanup that ran mid-session
   * called setDoorBrowseLive(false) + announceMapBrowseExited and left the map unusable. The stage
   * handle is read through a ref for the same reason (its identity changes when the map finishes
   * loading). A remount (Strict Mode's in development) puts browse back.
   */
  useEffect(() => {
    if (browseModeRef.current) {
      stageRef.current.setDoorBrowseLive(true);
      announceMapBrowseEntered();
    }
    const onEnter = () => enterBrowseRef.current();
    const onExit = () => exitBrowseRef.current();
    const onPop = (event: PopStateEvent) => {
      const onBrowseEntry =
        (event.state as { doorBrowse?: number } | null)?.doorBrowse === 1 &&
        window.location.pathname.startsWith('/explore');
      if (browseModeRef.current && !onBrowseEntry) {
        // Back (or swipe-back) already stepped over our `/explore` entry; do not step again.
        leaveBrowseRef.current(true);
      } else if (!browseModeRef.current && onBrowseEntry) {
        // Forward onto the `/explore` entry: show the map the address bar now names.
        startBrowseRef.current(false);
      }
    };
    window.addEventListener(MAP_BROWSE_ENTER_EVENT, onEnter);
    window.addEventListener(MAP_BROWSE_EXIT_EVENT, onExit);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener(MAP_BROWSE_ENTER_EVENT, onEnter);
      window.removeEventListener(MAP_BROWSE_EXIT_EVENT, onExit);
      window.removeEventListener('popstate', onPop);
      if (browseMorphTimerRef.current !== null) {
        window.clearTimeout(browseMorphTimerRef.current);
        browseMorphTimerRef.current = null;
      }
      // The ref is left as it is: a real unmount discards it, and a remount needs it to re-arm.
      if (browseModeRef.current) {
        stageRef.current.setDoorBrowseLive(false);
        announceMapBrowseExited();
      }
    };
  }, []);

  const goToStep = useCallback(
    (next: number) => {
      if (browseModeRef.current) return;
      const clamped = Math.min(Math.max(next, 0), stops.length);
      stepFocusPendingRef.current = true;
      setStep(clamped);
    },
    [stops.length],
  );

  /* —— The live plate ————————————————————————————————————————————————————————————————
     The same field Explore paints. `patchData` is also what wakes the shared plate on this
     surface (MapStage builds MapLibre on first contact). */
  useEffect(() => {
    if (browseModeRef.current) return;
    stage.patchData(nationalFieldPatch(sweptPins, { densityLevels }));
  }, [densityLevels, sweptPins, stage]);

  /** True once the plate has reported a viewport, which it only does once MapLibre has built. */
  const [plateLive, setPlateLive] = useState(false);
  /** True once the plate has said it cannot paint at all (no WebGL, or the context is gone). */
  const [plateUnavailable, setPlateUnavailable] = useState(false);
  useEffect(
    () =>
      stage.subscribe('viewport', () => {
        setPlateLive(true);
        setPlateUnavailable(false);
      }),
    [stage],
  );
  useEffect(
    () =>
      stage.subscribe('error', () => {
        setPlateLive(false);
        setPlateUnavailable(true);
      }),
    [stage],
  );

  /**
   * True once THIS mount has landed its own frame on the shared plate. `plateLive` alone is
   * stale on arrival: the plate is a persistent singleton and `subscribe` replays the last
   * viewport it ever reported, from whatever page was live before this one.
   */
  const [framed, setFramed] = useState(false);
  /** The first frame after mount is a cut, so a warm plate is never seen arriving from elsewhere. */
  const firstFrameRef = useRef(true);
  /** The boxes the last frame was computed against, so a resize only refits when they moved. */
  const lastFrameBoxesRef = useRef<DoorFrameBoxes>({ window: null, plate: null });
  const measureFrameBoxes = useCallback((map: { getContainer(): HTMLElement }): DoorFrameBoxes => {
    return {
      window: boxOf(windowRef.current),
      // MapLibre's own container: on the Door the whole viewport (posture `ambient`, shell.css).
      plate: boxOf(map.getContainer()),
    };
  }, []);

  /**
   * Point the plate at the country, framed against the map window: the Atlas's own national
   * preset, with the window's insets as the fit's padding (`doorFramePadding`), so the country
   * sits right of the column on a desktop and above the dock on a phone. Flat and unrotated: the
   * walk fills the map with records rather than flying between them.
   *
   * `cut` lands the frame in one step: the first frame after mount, and every refit after a
   * resize, where the plate has to keep step with a layout that does not animate its own reflow.
   */
  /** The tour step in front of the reader (door-tour-scroll.tsx), or null off the tour. */
  const tourRef = useRef<DoorTourTarget | null>(null);
  const applyCamera = useCallback(
    (cut: boolean): boolean => {
      if (browseModeRef.current) return false;
      const map = stage.getMap();
      if (!map) return false;
      const boxes = measureFrameBoxes(map);
      lastFrameBoxesRef.current = boxes;
      const { window: windowBox, plate: plateBox } = boxes;
      map.stop();
      const padding = windowBox && plateBox ? doorFramePadding(windowBox, plateBox) : null;
      // A tour step in front of the reader: its record, no tighter than its precision allows,
      // framed in the same window. One flight per step change (the tour listener below).
      const tour = tourRef.current;
      if (tour) {
        stage.flyPreset(
          'point',
          { center: [tour.lngLat[0], tour.lngLat[1]], zoom: tourZoom(tour.precision) },
          { mode: cut ? 'cut' : 'fly', pitch: 0, bearing: 0, ...(padding ? { padding } : {}) },
        );
        return true;
      }
      // The opening is Orbit: the whole globe in the map window, every record one light. The
      // decade walk comes down to the national frame, where the place tokens can be read.
      if (stepRef.current === 0 && windowBox) {
        stage.flyPreset(
          'national',
          { center: DOOR_ORBIT_CENTER, zoom: doorOrbitZoom(windowBox) },
          {
            mode: cut ? 'cut' : 'ease',
            pitch: 0,
            bearing: 0,
            zoomFloor: 'fit',
            ...(padding ? { padding } : {}),
          },
        );
        return true;
      }
      stage.flyPreset(
        'national',
        { bounds: US_CONUS_BOUNDS },
        {
          mode: cut ? 'cut' : 'ease',
          pitch: 0,
          bearing: 0,
          zoomFloor: 'fit',
          ...(padding ? { padding } : {}),
        },
      );
      return true;
    },
    [measureFrameBoxes, stage],
  );

  /**
   * A place tapped on the Door's plate opens one level deeper, framed in the map window. Without
   * this the stage frames the place against the whole canvas, which lands it behind the column
   * (desktop) or the dock (phone). Browse skips it: Atlas owns the camera there.
   */
  useEffect(
    () =>
      stage.subscribe('placeSelect', (placeKey, frame) => {
        const map = stage.getMap();
        if (browseModeRef.current || !frame || !map) return;
        // Nothing finer to zoom to: the place's records are only known to the place, so open them.
        if (frame.openZoom === undefined) {
          startBrowse(true, placeKey);
          return;
        }
        const { window: windowBox, plate: plateBox } = measureFrameBoxes(map);
        const padding = windowBox && plateBox ? doorDrillPadding(windowBox, plateBox) : null;
        const [west, south, east, north] = frame.bounds;
        const fit = map.cameraForBounds(
          [
            [west, south],
            [east, north],
          ] as never,
          { padding: padding ?? 48 } as never,
        );
        stage.flyPreset(
          'point',
          {
            center: [(west + east) / 2, (south + north) / 2],
            zoom: placeDrillZoom(frame.level, fit?.zoom, MAP_MAX_ZOOM, frame.openZoom),
          },
          { mode: 'ease', pitch: 0, bearing: 0, ...(padding ? { padding } : {}) },
        );
      }),
    [measureFrameBoxes, stage, startBrowse],
  );

  /** The national frame, landed once the plate is live (and re-landed on a resize, below). */
  useEffect(() => {
    if (!plateLive) return;
    /*
     * Browse skips walk framing (`applyCamera` returns false while armed) because Atlas owns the
     * camera. Cold `/explore` mounts already in browse, so without this path `framed` never
     * flips and `.ds-door__field` keeps the opaque canvas cover over the live plate forever.
     */
    if (browseModeRef.current) {
      firstFrameRef.current = false;
      setFramed(true);
      return;
    }
    if (!applyCamera(firstFrameRef.current)) return;
    firstFrameRef.current = false;
    setFramed(true);
  }, [applyCamera, plateLive]);

  /** Orbit to the national frame and back, when the reader enters or leaves the decade walk. */
  const atOpening = step === 0;
  const wasAtOpeningRef = useRef(atOpening);
  useEffect(() => {
    if (wasAtOpeningRef.current === atOpening) return;
    wasAtOpeningRef.current = atOpening;
    if (plateLive) applyCamera(false);
  }, [applyCamera, atOpening, plateLive]);

  /**
   * The dock's height is the stacked window's bottom edge (door-home.css reads
   * `--ds-door-dock-h`), so each chapter's card, whatever its length, leaves the map above it
   * framed rather than covered.
   */
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock || typeof ResizeObserver === 'undefined') return;
    // On the body, so the map attribution (a sibling of this tree) can clear the dock too.
    const root = document.body;
    const publish = () => root.style.setProperty('--ds-door-dock-h', `${dock.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--ds-door-dock-h');
    };
  }, []);

  /**
   * Re-frame when the map window or the canvas changes: a window resize, the dock growing with a
   * longer chapter, a phone's toolbar collapsing. A cut when the camera is at rest (a flight
   * re-aimed when it is not), one per animation frame however many events arrive, and only when a
   * box actually moved (`sameDoorFrameBox`).
   */
  useEffect(() => {
    if (!plateLive) return;
    const target = windowRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    let frame: number | null = null;
    const refit = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const map = stage.getMap();
        if (!map) return;
        if (sameDoorFrameBoxes(measureFrameBoxes(map), lastFrameBoxesRef.current)) return;
        // MapLibre re-measures its own container on its own observer; measure first so the fit
        // is computed against the canvas as it is now, not as it was a frame ago.
        stage.resize();
        // Cut only a camera at rest. A camera already moving is re-aimed at the new frame from
        // where it is instead of being jumped to its end.
        applyCamera(!map.isMoving());
      });
    };
    const observer = new ResizeObserver(refit);
    observer.observe(target);
    window.addEventListener('resize', refit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refit);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [applyCamera, measureFrameBoxes, plateLive, stage]);

  /** The current record on the plate: the opening's, or the current decade's. */
  const selectedPinId = current?.pinId ?? null;
  useEffect(() => {
    // In browse the selection is Explore's: the spotlight must not overwrite a deep-linked record.
    if (!plateLive || browseMode) return;
    stage.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: selectedPinId ?? undefined,
    });
  }, [browseMode, selectedPinId, plateLive, stage]);

  /**
   * The tour hands over its step: fly to that record and mark it selected, or (null, the tour is
   * out of view) go back to the national frame and the opening's own selection.
   */
  const selectedPinIdRef = useRef(selectedPinId);
  selectedPinIdRef.current = selectedPinId;
  useEffect(() => {
    const onTour = (event: Event) => {
      const target = (event as CustomEvent<DoorTourTarget | null>).detail;
      tourRef.current = target;
      // The tour flies to its own records; a rail that had dimmed one would hide its pin.
      if (target) setRailDecade(null);
      if (browseModeRef.current) return;
      applyCamera(false);
      stage.applyViewState({
        selectedState: undefined,
        selectedEdge: undefined,
        selectedEntity: (target ? target.pinId : selectedPinIdRef.current) ?? undefined,
      });
    };
    window.addEventListener(DOOR_TOUR_EVENT, onTour);
    return () => window.removeEventListener(DOOR_TOUR_EVENT, onTour);
  }, [applyCamera, stage]);

  /** A marker click on the live plate opens the record the pin's href names. */
  const hrefByPinId = useMemo(() => {
    const byId = new Map<string, string>();
    for (const feature of pins.features) {
      const href = feature.properties.href;
      if (href.length > 0) byId.set(feature.properties.entityId, href);
    }
    return byId;
  }, [pins]);
  /*
   * Clicking an entity during the walk means "stop the tour, show me that one": the same selection
   * every pin click on this map makes. The Door saves the pin, hands off to browse (`enterBrowse`,
   * the same plate, no navigation), and Explore restores it through the one `frameRecord`
   * contract. Overlapping pins hand off as a group and open the chooser.
   */
  useEffect(() => {
    const pinFor = (entityId: string) => {
      const feature = pins.features.find((row) => row.properties.entityId === entityId);
      return feature
        ? {
            pinId: entityId,
            lng: feature.geometry.coordinates[0]!,
            lat: feature.geometry.coordinates[1]!,
            label: feature.properties.displayName,
          }
        : null;
    };
    const offSelect = stage.subscribe('select', (entityId) => {
      if (browseModeRef.current || !hrefByPinId.has(entityId)) return;
      const pin = pinFor(entityId);
      if (!pin) return;
      savePinContinuity({ entityId, lng: pin.lng, lat: pin.lat, label: pin.label });
      enterBrowse();
    });
    const offOverlap = stage.subscribe('overlap', (entityIds) => {
      if (browseModeRef.current) return;
      const overlap = entityIds
        .map(pinFor)
        .filter((pin): pin is NonNullable<typeof pin> => pin !== null)
        .map(({ pinId, lng, lat }) => ({ pinId, lng, lat }));
      const first = overlap[0];
      if (!first) return;
      savePinContinuity({ entityId: first.pinId, lng: first.lng, lat: first.lat, overlap });
      enterBrowse();
    });
    return () => {
      offSelect();
      offOverlap();
    };
  }, [enterBrowse, hrefByPinId, pins.features, stage]);

  /** Pin photos rise from live markers. */
  const [pinPhotoTarget, setPinPhotoTarget] = useState<PinPhotoHoverTarget | null>(null);
  useEffect(
    () =>
      stage.subscribe('pinHover', (target) =>
        setPinPhotoTarget(
          target ? { key: target.entityId, name: target.name, rect: target.rect } : null,
        ),
      ),
    [stage],
  );

  const plateState: DoorPlateState = plateUnavailable ? 'unavailable' : framed ? 'live' : 'pending';

  /** The plate never painted: say so with the plain list of places, from data the page holds. */
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (plateState !== 'pending') {
      setStalled(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setStalled(true), PLATE_STALL_MS);
    return () => window.clearTimeout(timer);
  }, [plateState]);
  const topPlaces = useMemo(
    () =>
      [...densityLevels]
        .filter((level) => level.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, FALLBACK_PLACE_COUNT),
    [densityLevels],
  );
  const showPlaces = (plateState === 'unavailable' || stalled) && topPlaces.length > 0;

  const liveLabel = browseMode
    ? 'Browsing the map'
    : railOn
      ? timeRailText(railDecade, railCounts.lit, railCounts.undated)
      : !current || step === 0
        ? 'The world, lit where records are published'
        : `${current.decade}s. ${current.name}${current.locality ? `, ${current.locality}` : ''}`;

  return (
    <>
      <aside
        className="ds-door__field"
        aria-label="National map"
        data-plate={plateState}
        data-browse={browseMode ? 'on' : 'off'}
      >
        {/* The map window: the uncovered part of the plate. Measured for the camera frame
            (door-field-frame.ts) and the callout's bounds; nothing is drawn in it. */}
        {/* v11: the world is the ground. The record's photograph no longer sits behind the map. */}
        <div className="ds-door__window" ref={windowRef} aria-hidden="true" />
        {plateUnavailable ? (
          /* No WebGL: say so where the map would be, and point at the index that needs none. */
          <p className="ds-door__field-note" role="status">
            {readAsDocuments()
              ? 'The map is off while you read as documents.'
              : 'The map could not start in this browser.'}{' '}
            <Link href="/records">Browse the records</Link> instead.
          </p>
        ) : null}
        {/* Said once, in plain meta type, and gone when the plate has painted. */}
        <p className="ds-door__loading" aria-live="polite">
          {plateState === 'pending' ? 'Loading the map' : ''}
        </p>
        {showPlaces ? (
          <div className="ds-door__places">
            <p className="ds-door__places-title">Records by state</p>
            <ul className="ds-door__places-list">
              {topPlaces.map((level) => (
                <li key={level.stateFips}>
                  {level.stateName}
                  <span className="ds-door__places-count">
                    {level.count.toLocaleString('en-US')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="ds-door__live" aria-live="polite">
          {liveLabel}
        </p>
      </aside>

      <div
        className={`ds-door-journey${browseMode ? ' ds-door-journey--browse' : ''}`}
        id="door-journey"
        ref={journeyRef}
        tabIndex={-1}
        inert={browseMode}
        aria-hidden={browseMode ? true : undefined}
        data-step={step}
      >
        {current ? (
          <DoorSpotlightCallout
            active={plateState === 'live' && !browseMode}
            lngLat={current.lngLat}
            mark={recordMarkFor(current.precision)}
            name={current.name}
            locality={current.locality}
            href={current.href}
            frameRef={windowRef}
          />
        ) : null}
        {step === 0 && plateState === 'live' ? (
          <DoorTimeRail
            bars={bars}
            value={railDecade}
            onChange={setRailDecade}
            lit={railCounts.lit}
            undated={railCounts.undated}
          />
        ) : null}
        <div className="ds-door__dock" ref={dockRef} data-step={step === 0 ? 'open' : 'walk'}>
          {step === 0 ? (
            <section
              className="ds-door-open"
              aria-labelledby="door-open-heading"
              data-ground="ink"
              data-ground-fixed=""
            >
              {/* The headline and the one way into a story lead; the record the map points at
                  follows (desktop only: a phone's column is the headline and the story, and the
                  map is the second beat). */}
              <HeroHeadlineMorph className="ds-door-open__headline" id="door-open-heading" />
              <p className="ds-door-open__line">{DOOR_OPEN_LINE}</p>
              {/* One primary into the lead story and one quiet secondary into the walk, at their
                  content width; the story is named in the meta line above them. */}
              {story ? (
                <p className="ds-door-open__lead">
                  <span className="ds-visually-hidden">Lead story, </span>
                  <span aria-hidden="true">Lead story · </span>
                  {story.title}
                </p>
              ) : null}
              <div className="ds-door-open__cta">
                {story ? (
                  <Link
                    className={buttonClassName('primary', 'ds-door-open__story')}
                    href={`/stories/${story.slug}`}
                    aria-label={`Read the chapter, ${story.title}`}
                  >
                    Read the chapter
                  </Link>
                ) : null}
                {stops.length > 0 ? (
                  <button
                    ref={startRef}
                    type="button"
                    className={buttonClassName('secondary', 'ds-door-open__start')}
                    onClick={() => goToStep(1)}
                  >
                    Walk the decades
                  </button>
                ) : null}
              </div>
              {/* v11 Orbit: the opening is the headline and the ways in. What the lights mean is
                  said here, once, because unlit ground reads as "nothing happened there". */}
              {/* The page goes on below the map; say so in words, and make it a way there. */}
              <a className="ds-door-open__next" href="#door-ch-evidence-band">
                Below the map, how every record is graded
              </a>
              <p className="ds-door-open__coverage">
                Each light is a record published so far. Unlit places are not yet researched.{' '}
                <Link href="/methodology">How coverage works</Link>
              </p>
              <div className="ds-door-open__actions">
                <Link
                  className={buttonClassName('quiet', 'ds-door-open__browse-link')}
                  href="/records"
                >
                  Browse all records
                </Link>
              </div>
            </section>
          ) : current ? (
            <DoorWalkCard
              key={current.decade}
              record={current}
              position={step}
              stops={stops}
              bars={bars}
              caption={barsCaption}
              headingRef={walkHeadingRef}
              onGo={goToStep}
              onSkip={enterBrowse}
            />
          ) : null}
        </div>
      </div>

      {browseMounted ? (
        <div
          className="ds-door__browse"
          aria-label="Map browse"
          inert={!browseMode}
          aria-hidden={!browseMode ? true : undefined}
          data-cold={initialBrowse ? 'true' : undefined}
        >
          {/* The opening's h1 is hidden while browse is armed; this keeps one h1 on the page. */}
          <h1 className="ds-visually-hidden" ref={browseHeadingRef} tabIndex={-1}>
            Explore the map
          </h1>
          <AtlasLoader shell={browseShell} pins={pins} embedded />
        </div>
      ) : null}

      {browseMode ? null : <PinPhotoLayer target={pinPhotoTarget} photosUrl="/door/photos" />}
    </>
  );
}
