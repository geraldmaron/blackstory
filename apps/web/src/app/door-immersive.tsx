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
import { recordMarkFor, zoomForLocationPrecision } from '../lib/map-experience/geo-precision';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { nationalFieldPatch } from '../lib/map-experience/national-field';
import { earliestDecadeFor } from '../lib/map-experience/decade-transition';
import { HeroHeadlineMorph } from '../components/story/HeroHeadlineMorph';
import type { DecadeBar, DoorJourneyRecord } from './door-decade-walk';
import {
  PinPhotoLayer,
  type PinPhotoHoverTarget,
} from '../components/map-experience/PinPhotoLayer';
import { fitBoundsCamera } from '../components/map-stage/camera';
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
import {
  easeTourCamera,
  measureTourLayout,
  tourCameraAt,
  tourMarkedStop,
  tourNearestStop,
  tourPhase,
  type TourCamera,
  type TourCameras,
  type TourLayout,
} from './door-tour-scrub';
import { LIGHTS_DEEP_MAX_ZOOM } from './map/explore-style';
import { groundFrameFor } from '../components/map-stage/RecordGround';
import { placeDrillZoom } from '../lib/map-experience/place-map';
import { MAP_MAX_ZOOM } from '../lib/map-experience/camera-presets';
import { holdStill, readAsDocuments } from '../lib/map-experience/world-prefs';

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
/** How long the scroll rests before the tour brings back what it holds for a rest: the map's
 * names, and a landing's aerial imagery. */
const TOUR_REST_MS = 260;
/** How quickly the tour's camera closes on where the scroll puts it, as a time constant in ms:
 * long enough to smooth a wheel's coarse steps, short enough that the camera keeps up. */
const TOUR_EASE_MS = 140;

type TourStage = { readonly flyPreset: ReturnType<typeof useMapStage>['flyPreset'] };

/** The tour camera's eased follow of the scroll: where it is, where the scroll wants it, and the
 * animation frame that closes the gap. */
type TourFollow = {
  current: TourCamera | null;
  target: TourCamera | null;
  frame: number | null;
  last: number;
};

/** One eased frame toward the target. True while the camera has not arrived. */
function easeTourFollow(follow: TourFollow, stage: TourStage, now: number): boolean {
  const { current, target } = follow;
  if (!current || !target) return false;
  const k = 1 - Math.exp(-(now - follow.last) / TOUR_EASE_MS);
  follow.last = now;
  const { camera: shown, arrived } = easeTourCamera(current, target, k);
  follow.current = shown;
  stage.flyPreset(
    'point',
    { center: [shown.center[0], shown.center[1]], zoom: shown.zoom },
    { mode: 'cut', pitch: shown.pitch, bearing: 0, padding: shown.padding },
  );
  return !arrived;
}

/** Starts the frame loop if it is not running; a running loop picks up the new target itself. */
function followTourCamera(follow: TourFollow, stage: TourStage): void {
  if (follow.frame !== null) return;
  const tick = (now: number) => {
    follow.frame = null;
    if (easeTourFollow(follow, stage, now)) follow.frame = window.requestAnimationFrame(tick);
  };
  follow.last = performance.now();
  follow.frame = window.requestAnimationFrame(tick);
}

/** Ends the follow: the next tour frame starts from the scroll's own camera, not a stale one. */
function stopTourFollow(follow: TourFollow): void {
  if (follow.frame !== null) window.cancelAnimationFrame(follow.frame);
  follow.frame = null;
  follow.current = null;
  follow.target = null;
}
/** How close the decade walk comes to a decade's record: a region, so its neighbors still show. */
const DOOR_WALK_ZOOM = 5.4;

/** The opening's line: what is here and where, not how to use the page. It names the country,
    because a globe on its own reads as "the world's records". */
const DOOR_OPEN_LINE =
  'Black history has an address. Thousands of them across the United States, every one sourced.';

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
  readonly story: {
    readonly title: string;
    readonly slug: string;
    /** The years the story covers, as its own cover prints them ("1787–present"). */
    readonly era?: string;
  } | null;
  /** The walk: one record per decade, oldest first. */
  readonly stops: readonly DoorJourneyRecord[];
  /** The tour's records, in order (door-tour.ts): the camera's landings as the page scrolls. */
  readonly tour?: readonly DoorJourneyRecord[];
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
  tour = [],
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
  /** Where a tour stop's record is framed: what the stop's words leave uncovered (door-tour.css). */
  const tourWindowRef = useRef<HTMLDivElement | null>(null);

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
  /** True while the camera rests on a tour stop whose stored precision allows aerial imagery. */
  const [tourImagery, setTourImagery] = useState(false);
  useEffect(() => {
    if (browseModeRef.current) return;
    stage.patchData(nationalFieldPatch(sweptPins, { densityLevels, satellite: tourImagery }));
  }, [densityLevels, sweptPins, stage, tourImagery]);

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
  /* —— The tour's scrub ————————————————————————————————————————————————————————————
     While the page is scrolled into the tour, the camera is a function of the scroll position
     (door-tour-scrub.ts): scroll a little and it moves a little, scroll back and it reverses.
     The words read the same path (door-tour-scroll.tsx). */
  const scrubRef = useRef<{
    layout: TourLayout | null;
    cameras: TourCameras | null;
    active: boolean;
    nearest: number | null;
    restTimer: number | null;
    lastScrollAt: number;
    lastY: number;
    follow: TourFollow;
  }>({
    layout: null,
    cameras: null,
    active: false,
    nearest: null,
    restTimer: null,
    lastScrollAt: 0,
    lastY: -1,
    follow: { current: null, target: null, frame: null, last: 0 },
  });
  const tourRecordsRef = useRef(tour);
  tourRecordsRef.current = tour;
  /** The decade walk's record on screen, for the camera. */
  const walkRecordRef = useRef<DoorJourneyRecord | null>(null);
  walkRecordRef.current = step > 0 ? (stops[step - 1] ?? null) : null;
  /** The path's cameras for the window as it is now: the opening, the globe between stops, and
   * one landing per stop at the frame its stored precision allows (never tighter). */
  const tourCameras = useCallback((map: { getContainer(): HTMLElement }): TourCameras | null => {
    const plate = boxOf(map.getContainer());
    const openingWindow = boxOf(windowRef.current);
    const stopWindow = boxOf(tourWindowRef.current);
    if (!plate || !openingWindow || !stopWindow) return null;
    const none = { top: 0, right: 0, bottom: 0, left: 0 };
    // Between stops the map has the stage: everything under the bar.
    const stageBox = {
      top: openingWindow.top,
      left: plate.left,
      width: plate.width,
      height: plate.top + plate.height - openingWindow.top,
    };
    const landing = doorFramePadding(stopWindow, plate) ?? none;
    return {
      opening: {
        center: DOOR_ORBIT_CENTER,
        zoom: doorOrbitZoom(openingWindow),
        pitch: 0,
        padding: doorFramePadding(openingWindow, plate) ?? none,
      },
      orbit: {
        center: DOOR_ORBIT_CENTER,
        zoom: doorOrbitZoom(stageBox),
        pitch: 0,
        padding: doorFramePadding(stageBox, plate) ?? none,
      },
      span: Math.min(stageBox.width, stageBox.height),
      stops: tourRecordsRef.current.map((record) => {
        const frame = groundFrameFor(record.precision, false);
        return {
          center: [record.lngLat[0], record.lngLat[1]] as const,
          zoom: frame.zoom,
          pitch: frame.pitch,
          padding: landing,
        };
      }),
    };
  }, []);

  /**
   * Puts the camera where the scroll says. Returns true while the tour has the map. Called on
   * every scrolled frame, and by `applyCamera` so a resize mid-tour re-aims at the same place.
   */
  const applyScrub = useCallback((): boolean => {
    const scrub = scrubRef.current;
    const records = tourRecordsRef.current;
    if (records.length === 0 || browseModeRef.current || stepRef.current !== 0) {
      stopTourFollow(scrub.follow);
      return false;
    }
    scrub.layout ??= measureTourLayout();
    if (!scrub.layout) return false;
    const phase = tourPhase(window.scrollY, scrub.layout);
    const nearest = tourNearestStop(phase, records.length);
    // Not allowed to move (reduced motion, or the reader's "Hold still").
    const still = prefersReducedMotion() || holdStill();

    if (phase.active !== scrub.active) {
      scrub.active = phase.active;
      // The tour is about one record at a time: no place counts on the way there or around it,
      // and the lights stay lit the whole way down (MapStage, `setPlaceTokens`).
      if (phase.active) stage.setPlaceTokens(false);
      else {
        // The counts come back once the camera has landed, not when the scroll leaves. Leaving
        // starts a flight out to the opening (`applyCamera`, after this returns), and every zoom
        // it crosses above Orbit drew the counts and their tethers over the globe on the way.
        const restore = () => {
          if (!scrub.active) stage.setPlaceTokens(true);
        };
        window.requestAnimationFrame(() => {
          const map = stage.getMap();
          if (map?.isMoving()) map.once('moveend', restore);
          else restore();
        });
      }
      // The tour goes to its own records; a rail that had dimmed one would hide its pin.
      if (phase.active) setRailDecade(null);
    }
    const marked = tourMarkedStop(phase, records.length);
    if (marked !== scrub.nearest) {
      scrub.nearest = marked;
      stage.applyViewState({
        selectedState: undefined,
        selectedEdge: undefined,
        selectedEntity:
          (marked === null ? selectedPinIdRef.current : records[marked]?.pinId) ?? undefined,
      });
    }

    // What waits for the scroll to rest. Aerial imagery belongs to a landing: on once the scroll
    // has rested on an exact site, off the moment the camera leaves, so none is fetched for the
    // zooms the scrub passes through. The map's own names stand down while the camera travels
    // (`setMapLabels`) and return when it stops.
    const landed = phase.active && phase.from === phase.to ? records[phase.from - 1] : undefined;
    // A reader can also stop short of a landing, with the camera already near the ground. The
    // lights have faded by then (`LIGHTS_DEEP_MAX_ZOOM`), so without imagery the rest is an empty
    // plate with one pin. Resting there gets the nearest stop's imagery too; it still goes the
    // moment the scroll moves, so the scrub itself fetches none.
    const plate = phase.active ? stage.getMap() : null;
    if (plate) scrub.cameras ??= tourCameras(plate);
    const scrubbed = phase.active && scrub.cameras ? tourCameraAt(phase, scrub.cameras) : null;
    const short =
      landed === undefined &&
      nearest !== null &&
      scrubbed !== null &&
      scrubbed !== undefined &&
      scrubbed.zoom >= LIGHTS_DEEP_MAX_ZOOM - 1
        ? records[nearest]
        : undefined;
    const rest = landed ?? short;
    const wantsImagery = rest !== undefined && groundFrameFor(rest.precision, false).imagery;
    if (scrub.restTimer !== null) {
      window.clearTimeout(scrub.restTimer);
      scrub.restTimer = null;
    }
    // Only a scroll that moved takes it away: this also runs on a refit, with the reader at rest.
    const moved = window.scrollY !== scrub.lastY;
    scrub.lastY = window.scrollY;
    if (!wantsImagery || (short !== undefined && moved)) setTourImagery(false);
    if (!phase.active) stage.setMapLabels(true);
    else {
      if (!still) stage.setMapLabels(false);
      // Rest is measured from the last scroll event, and read inside a frame. After a long frame
      // on a slow device the timer fires before the scroll events that queued up behind it; the
      // browser delivers those ahead of a frame callback, so the check waits for one. Bringing
      // the names back mid-dive, even for one frame, costs about a second of placing them again.
      const rested = () => {
        scrub.restTimer = null;
        window.requestAnimationFrame(() => {
          if (scrub.restTimer !== null) return;
          const wait = TOUR_REST_MS - (performance.now() - scrub.lastScrollAt);
          if (wait > 0) {
            scrub.restTimer = window.setTimeout(rested, wait);
            return;
          }
          stage.setMapLabels(true);
          if (wantsImagery) setTourImagery(true);
        });
      };
      scrub.restTimer = window.setTimeout(rested, TOUR_REST_MS);
    }

    if (!phase.active) {
      stopTourFollow(scrub.follow);
      return false;
    }
    const map = stage.getMap();
    if (!map) return true;
    scrub.cameras ??= tourCameras(map);
    if (!scrub.cameras) return true;
    // Not allowed to move (reduced motion, or the reader's "Hold still"): the camera cuts to
    // the stop it is nearest, or back to the opening, and holds there.
    const camera = still
      ? nearest === null
        ? scrub.cameras.opening
        : scrub.cameras.stops[nearest]
      : tourCameraAt(phase, scrub.cameras);
    if (!camera) return true;
    map.stop();
    if (still) {
      // A cut through the stage's own camera route (camera.ts): one frame, no flight of its own.
      stopTourFollow(scrub.follow);
      stage.flyPreset(
        'point',
        { center: [camera.center[0], camera.center[1]], zoom: camera.zoom },
        { mode: 'cut', pitch: camera.pitch, bearing: 0, padding: camera.padding },
      );
    } else {
      // Eased: the scroll sets where the camera is going, and the frames close on it.
      scrub.follow.current ??= camera;
      scrub.follow.target = camera;
      followTourCamera(scrub.follow, stage);
    }
    return true;
  }, [stage, tourCameras]);

  const applyCamera = useCallback(
    (cut: boolean): boolean => {
      if (browseModeRef.current) return false;
      const map = stage.getMap();
      if (!map) return false;
      const boxes = measureFrameBoxes(map);
      lastFrameBoxesRef.current = boxes;
      const { window: windowBox, plate: plateBox } = boxes;
      // The window may have changed shape: the tour's cameras are for the old one.
      scrubRef.current.cameras = null;
      scrubRef.current.layout = null;
      // Scrolled into the tour, the scroll position is the camera.
      if (applyScrub()) return true;
      map.stop();
      const padding = windowBox && plateBox ? doorFramePadding(windowBox, plateBox) : null;
      // The decade walk goes to each decade's record: close enough to place it, far enough out
      // that the records documented around it still show. `flyTo` pulls out as far as the trip
      // needs: barely for a neighbor, to the country for the far coast.
      const walking = stepRef.current > 0 ? walkRecordRef.current : null;
      if (walking) {
        stage.flyPreset(
          'state',
          {
            center: [walking.lngLat[0], walking.lngLat[1]],
            zoom: Math.min(DOOR_WALK_ZOOM, zoomForLocationPrecision(walking.precision)),
          },
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
    [applyScrub, measureFrameBoxes, stage],
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
        const fit = fitBoundsCamera(map, frame.bounds, padding ?? 48);
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
    // Back to the opening. Into the walk, the step's own effect below aims the camera.
    if (plateLive && atOpening) applyCamera(false);
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

  const selectedPinIdRef = useRef(selectedPinId);
  selectedPinIdRef.current = selectedPinId;
  /**
   * The scroll is the tour's camera. One passive listener, coalesced to a frame: nothing is
   * captured and nothing is timed, so the page scrolls at the reader's speed and the map keeps
   * up with it. Leaving the tour hands the map back to the opening's own frame.
   */
  useEffect(() => {
    if (!plateLive) return undefined;
    let frame: number | null = null;
    const sync = () => {
      frame = null;
      const wasActive = scrubRef.current.active;
      const active = applyScrub();
      if (wasActive && !active) applyCamera(false);
    };
    const scrub = scrubRef.current;
    const schedule = () => {
      scrub.lastScrollAt = performance.now();
      if (frame === null) frame = window.requestAnimationFrame(sync);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
      stopTourFollow(scrub.follow);
      if (scrub.restTimer !== null) window.clearTimeout(scrub.restTimer);
      scrub.restTimer = null;
      scrub.active = false;
      scrub.nearest = null;
      // The plate outlives this page: never leave the next surface without its tokens or names.
      stage.setPlaceTokens(true);
      stage.setMapLabels(true);
    };
  }, [applyCamera, applyScrub, plateLive, stage]);

  /** Each decade of the walk goes to its own record. */
  useEffect(() => {
    if (step > 0 && plateLive) applyCamera(false);
  }, [applyCamera, plateLive, step]);

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
        ? 'The globe, lit where United States records are published'
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
        {/* Where a tour stop frames its record. Measured only, like the window above. */}
        <div className="ds-door__tour-window" ref={tourWindowRef} aria-hidden="true" />
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
                  content width. The story is named above them as a thing to read, title first:
                  a kicker that says where to begin, the title in the column's own type, and the
                  years it covers. */}
              {story ? (
                <p className="ds-door-open__lead">
                  <span className="ds-door-open__lead-kicker">Start here</span>
                  <span className="ds-visually-hidden">, </span>
                  <span className="ds-door-open__lead-title">{story.title}</span>
                  {story.era ? (
                    <span className="ds-door-open__lead-era">
                      <span className="ds-visually-hidden">, </span>
                      {story.era}
                    </span>
                  ) : null}
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
                  said here, once, because unlit ground reads as "nothing happened there". It
                  also says the map stops at the country: on a globe, the dark over every other
                  continent would otherwise read as ground nobody has reached yet. "Almost",
                  because a few records are pinned abroad (three Cuban-born players, 2026-11-22).
                  The tour's own
                  cue (door-tour-section.tsx) says the page goes on. */}
              <p className="ds-door-open__coverage">
                Every light is a record that’s made it in so far. Where the country’s dark, nobody’s
                gotten there yet. Outside the United States, almost nothing is on this map.{' '}
                <Link href="/methodology">How coverage works</Link>
              </p>
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
