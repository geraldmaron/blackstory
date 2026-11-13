/**
 * The Door: the national map uncovered across the viewport, a headline column docked bottom-left
 * (beneath the map on a phone), the visit's spotlight record as a callout on its pin, and a guided
 * walk whose chapters fly the same plate.
 *
 * One visit rolls chapters / facts / spotlight on the server so SSR and hydrate match.
 *
 * THE MAP IS EXPLORE'S MAP, AND IT IS THE ONLY MAP HERE. The Door hands the persistent `MapStage`
 * the same national-field patch Explore rests on (`nationalFieldPatch`) and flies its camera per
 * chapter.
 *
 * The walk is a stepper, not a scroll story: every chapter is the same compact card docked where
 * the headline column sits, with progress, Back / Next and "Skip to the map". The page itself does
 * not scroll, so there is no viewport-height dead space between chapters and the wheel is never
 * hijacked. Arrow keys step inside the card and Escape returns to the opening.
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
 * `select` and cluster-expand paths and hands off to browse.
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
import { CAMERA_EASING_SLOW_OUT } from '../lib/map-experience/camera-presets';
import { CAMERA_FLY_CURVE } from '../lib/map-experience/camera-moves';
import { recordMarkFor } from '../lib/map-experience/geo-precision';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { nationalFieldPatch } from '../lib/map-experience/national-field';
import {
  earliestDecadeFor,
  sweep,
  SWEEP_CLEAR_HOLD_MS,
  type SweepHandle,
} from '../lib/map-experience/decade-transition';
import { DECADE_LAYER_FADE_MS } from './map/decade-layer-transition';
import { sweepRange } from './door-sweep';
import type { StoryChapter } from '../lib/story/chapters';
import type { StoryRecordSpotlight } from '../lib/story/pick-story-record';
import type { StoryFact } from '../lib/story/story-facts';
import { hereLocality } from './door-here';
import { HeroHeadlineMorph } from '../components/story/HeroHeadlineMorph';
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
import { resolveDoorFocus, type DoorFocusCamera, type DoorFocusFrame } from './door-focus';
import {
  doorFrameOffset,
  doorFramePadding,
  sameDoorFrameBox,
  type DoorFrameBox,
} from './door-field-frame';
import { DoorSpotlightCallout } from './door-spotlight-callout';
import { chapterBody, DoorWalkCard } from './door-walk';

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

/** Same flight the Explore story mode gives a chapter. */
const CHAPTER_FLIGHT_MS = 1600;

/** The opening's one sentence: what is here, not how to use the page. */
const DOOR_OPEN_LINE =
  'People, places and events in Black American history, each pinned where its sources put it.';

/** The national chapters: flat, unrotated, and no closer than the story's opening zoom. */
const NATIONAL_CAMERA_MAX_ZOOM = 3.6;

function isNationalCamera(camera: DoorFocusCamera): boolean {
  return camera.pitch === 0 && camera.bearing === 0 && camera.zoom <= NATIONAL_CAMERA_MAX_ZOOM;
}

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

export type DoorImmersiveProps = {
  readonly pins: ExploreMapFeatureCollection;
  /** Per-state presence tiers, so the plate opens on the same tint Explore does. */
  readonly densityLevels: readonly StateDensityLevel[];
  /** Request-scoped Explore shell so browse morph can mount Atlas without a second navigation. */
  readonly browseShell: AtlasShellModel;
  readonly chapters: readonly StoryChapter[];
  readonly factByChapterId: Readonly<Record<string, StoryFact>>;
  readonly spotlight: StoryRecordSpotlight | null;
  readonly spotlightLngLat: readonly [number, number] | null;
  /** Opaque `pin-N` for the spotlight, resolved on the server so the catalog stays off `/`. */
  readonly spotlightPinId: string | null;
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
  chapters,
  factByChapterId,
  spotlight,
  spotlightLngLat,
  spotlightPinId,
  initialBrowse = false,
}: DoorImmersiveProps) {
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

  /** 0 is the opening; 1..n are the walk's chapters, in the order this visit drew them. */
  const [step, setStep] = useState(0);
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

  const initialFocus = useMemo(
    () =>
      resolveDoorFocus({
        chapter: chapters[0]!,
        spotlight,
        fact: undefined,
        spotlightLngLat,
      }),
    [chapters, spotlight, spotlightLngLat],
  );

  const [focus, setFocus] = useState<DoorFocusFrame>(initialFocus);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reducedMotionRef = useRef(false);
  reducedMotionRef.current = reducedMotion;

  /**
   * The decade the sweep chapter has filled the plate up to, or null when no sweep is running.
   *
   * The sweep chapter says "watch the record fill", so it has to be watchable: the plate
   * crossdissolves to an empty country, holds there, and then takes the archive back one decade at
   * a time, cumulatively. A cursor before the first decade matches nothing, which is the cleared
   * frame.
   */
  const [sweepDecade, setSweepDecade] = useState<number | null>(null);
  const sweepRef = useRef<SweepHandle | null>(null);
  const stopSweep = useCallback(() => {
    sweepRef.current?.cancel();
    sweepRef.current = null;
    setSweepDecade(null);
  }, []);
  // Stepping away mid-sweep, or leaving the Door entirely, must not strand a half-filled plate.
  useEffect(() => stopSweep, [stopSweep]);

  const decadeRange = useMemo(() => sweepRange(pins), [pins]);

  /**
   * What the plate shows this frame: the whole field, the cleared country, or the archive as of
   * the swept decade (which includes any outlier older than the sweep's first decade).
   */
  const sweptPins = useMemo<ExploreMapFeatureCollection>(() => {
    if (sweepDecade === null) return pins;
    if (decadeRange !== null && sweepDecade < decadeRange.from) return { ...pins, features: [] };
    return {
      ...pins,
      features: pins.features.filter((feature) => {
        const decade = earliestDecadeFor(feature);
        return decade !== null && decade <= sweepDecade;
      }),
    };
  }, [decadeRange, pins, sweepDecade]);

  /**
   * The one frame the plate crossdissolves rather than snapping: the cleared one. Removing
   * features from a GeoJSON source is otherwise instant, and a country's worth of pins vanishing
   * between frames reads as a fault rather than as the record being rewound.
   */
  const clearingPlate =
    sweepDecade !== null && (decadeRange === null || sweepDecade < decadeRange.from);
  const clearingPlateRef = useRef(clearingPlate);
  clearingPlateRef.current = clearingPlate;

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

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
    (push: boolean) => {
      if (browseModeRef.current) return;
      // The list waits on the catalog: start it now, not after the morph and the Atlas chunk.
      prefetchAtlasCatalog();
      browseReturnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      browseFocusPendingRef.current = true;
      browseModeRef.current = true;
      setBrowseMode(true);
      stopSweep();
      stage.setDoorBrowseLive(true);
      announceMapBrowseEntered();
      // Either way the page's `/` entry sits directly behind this one, so leaving steps back.
      enteredByPushRef.current = true;
      if (push) window.history.pushState({ doorBrowse: 1 }, '', '/explore');
      const delay = prefersReducedMotion() ? 0 : DOOR_BROWSE_MORPH_MS;
      if (browseMorphTimerRef.current !== null) {
        window.clearTimeout(browseMorphTimerRef.current);
      }
      browseMorphTimerRef.current = window.setTimeout(() => {
        browseMorphTimerRef.current = null;
        setBrowseMounted(true);
      }, delay);
    },
    [stage, stopSweep],
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

  /** The chapter the plate is currently framing; re-showing it must not restart its flight. */
  const lastChapterIdRef = useRef<string>(chapters[0]!.id);

  /** Frames a chapter on the plate and, for the sweep chapter, runs the decade sweep. */
  const showChapter = useCallback(
    (chapter: StoryChapter) => {
      if (browseModeRef.current) return;
      if (chapter.id === lastChapterIdRef.current) return;
      lastChapterIdRef.current = chapter.id;
      setFocus(
        resolveDoorFocus({
          chapter,
          spotlight,
          fact: factByChapterId[chapter.id],
          spotlightLngLat,
        }),
      );

      stopSweep();
      if (!chapter.sweep || decadeRange === null) return;
      const calm = prefersReducedMotion();
      sweepRef.current = sweep({
        from: decadeRange.from,
        to: decadeRange.to,
        onClear: () => setSweepDecade(decadeRange.from - 10),
        // Long enough for the clearing crossdissolve to land before the first decade arrives,
        // so the reader actually sees the empty country the chapter is about.
        clearHoldMs: calm ? SWEEP_CLEAR_HOLD_MS : DECADE_LAYER_FADE_MS + SWEEP_CLEAR_HOLD_MS,
        onDecade: setSweepDecade,
        // The last decade is not the end of the argument: the whole archive comes back, which
        // also returns every undated record the sweep had to leave out.
        onDone: () => setSweepDecade(null),
        reducedMotion: calm,
      });
    },
    [decadeRange, factByChapterId, spotlight, spotlightLngLat, stopSweep],
  );

  const goToStep = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), chapters.length - 1);
      stepFocusPendingRef.current = true;
      setStep(clamped);
      showChapter(chapters[clamped]!);
    },
    [chapters, showChapter],
  );

  const focusPinId =
    focus.focusEntityId !== null && spotlight !== null && focus.focusEntityId === spotlight.entityId
      ? spotlightPinId
      : null;

  /* —— The live plate ————————————————————————————————————————————————————————————————
     The same field Explore paints. `patchData` is also what wakes the shared plate on this
     surface (MapStage builds MapLibre on first contact). */
  useEffect(() => {
    if (browseModeRef.current) return;
    stage.patchData(
      nationalFieldPatch(sweptPins, { densityLevels }),
      clearingPlateRef.current ? { fade: true } : undefined,
    );
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
  const cameraRef = useRef<DoorFocusCamera>(focus.camera);
  cameraRef.current = focus.camera;
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
   * Point the plate at the current frame, framed against the map window.
   *
   * A national chapter fits CONUS inside the window through the Atlas's own national preset, with
   * the window's insets as the fit's padding (`doorFramePadding`), so the country sits right of the
   * headline column on a desktop and above the dock on a phone. Pitch and bearing are passed even
   * though a national chapter authors them as 0: stepping back from a tilted chapter has to be able
   * to say "flat". A place chapter keeps its own spec and lands the place at the window's center
   * through `offset`.
   *
   * `cut` lands the frame in one step: the first frame after mount, and every refit after a
   * resize, where the plate has to keep step with a layout that does not animate its own reflow.
   */
  const applyCamera = useCallback(
    (cut: boolean): boolean => {
      if (browseModeRef.current) return false;
      const map = stage.getMap();
      if (!map) return false;
      const camera = cameraRef.current;
      const boxes = measureFrameBoxes(map);
      lastFrameBoxesRef.current = boxes;
      const { window: windowBox, plate: plateBox } = boxes;
      map.stop();
      if (isNationalCamera(camera)) {
        const padding = windowBox && plateBox ? doorFramePadding(windowBox, plateBox) : null;
        stage.flyPreset(
          'national',
          { bounds: US_CONUS_BOUNDS },
          {
            mode: cut ? 'cut' : 'ease',
            pitch: camera.pitch,
            bearing: camera.bearing,
            zoomFloor: 'fit',
            ...(padding ? { padding } : {}),
          },
        );
        return true;
      }
      const offset = windowBox && plateBox ? doorFrameOffset(windowBox, plateBox) : null;
      const target = {
        center: [camera.center[0], camera.center[1]],
        zoom: camera.zoom,
        pitch: camera.pitch,
        bearing: camera.bearing,
        ...(offset ? { offset: [offset[0], offset[1]] } : {}),
      };
      if (cut || reducedMotionRef.current) {
        map.easeTo({ ...target, duration: 0 } as never);
        return true;
      }
      map.flyTo({
        ...target,
        duration: CHAPTER_FLIGHT_MS,
        curve: CAMERA_FLY_CURVE,
        easing: CAMERA_EASING_SLOW_OUT,
        // Ambient: a walk-driven move must stay suppressible under reduced motion.
        essential: false,
      } as never);
      return true;
    },
    [measureFrameBoxes, stage],
  );

  /** Chapter camera. The chapter's own MapLibre spec, flown the way the Explore story flies it. */
  const camera: DoorFocusCamera = focus.camera;
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
  }, [applyCamera, camera, plateLive]);

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

  /** The current record on the plate: the spotlight on the opening and on its own chapter. */
  const selectedPinId = step === 0 ? spotlightPinId : focusPinId;
  useEffect(() => {
    // In browse the selection is Explore's: the spotlight must not overwrite a deep-linked record.
    if (!plateLive || browseMode) return;
    stage.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: selectedPinId ?? undefined,
    });
  }, [browseMode, selectedPinId, plateLive, stage]);

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

  // The spotlight's public place URL, from the same pin table a marker click opens. The entity
  // path is only the fallback for a spotlight the plate carries no pin for.
  const spotlightHref = spotlight
    ? ((spotlightPinId ? hrefByPinId.get(spotlightPinId) : undefined) ??
      `/entity/${encodeURIComponent(spotlight.entityId)}`)
    : null;
  const spotlightLocality = spotlight ? hereLocality(spotlight.name, spotlight.place) : null;

  const walkChapters = chapters.slice(1);
  const currentChapter = chapters[step]!;
  const currentBody =
    step === 0
      ? null
      : chapterBody(currentChapter, spotlight, factByChapterId[currentChapter.id], decadeRange);

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
        <div className="ds-door__window" ref={windowRef} aria-hidden="true" />
        {plateUnavailable ? (
          /* No WebGL: say so where the map would be, and point at the index that needs none. */
          <p className="ds-door__field-note" role="status">
            The map could not start in this browser. <Link href="/records">Browse the records</Link>{' '}
            instead.
          </p>
        ) : null}
        <p className="ds-door__live" aria-live="polite">
          {browseMode ? 'Browsing the map' : focus.placeLabel}
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
        {spotlight && spotlightLngLat && spotlightHref ? (
          <DoorSpotlightCallout
            active={step === 0 && plateState === 'live' && !browseMode}
            lngLat={spotlightLngLat}
            mark={recordMarkFor(spotlight.precision)}
            name={spotlight.name}
            locality={spotlightLocality}
            line={spotlight.summary}
            href={spotlightHref}
            frameRef={windowRef}
          />
        ) : null}
        <div className="ds-door__dock" ref={dockRef} data-step={step === 0 ? 'open' : 'walk'}>
          {step === 0 ? (
            <section className="ds-door-open" aria-labelledby="door-open-heading" data-ground="ink">
              <HeroHeadlineMorph className="ds-door-open__headline" id="door-open-heading" />
              <p className="ds-door-open__line">{DOOR_OPEN_LINE}</p>
              <div className="ds-door-open__actions">
                <button
                  ref={startRef}
                  type="button"
                  className={buttonClassName('primary', 'ds-door-open__start')}
                  onClick={() => goToStep(1)}
                >
                  Start the walk
                </button>
                <Link className={buttonClassName('quiet')} href="/records">
                  Browse all records
                </Link>
              </div>
            </section>
          ) : currentBody ? (
            <DoorWalkCard
              key={currentChapter.id}
              chapter={currentChapter}
              body={currentBody}
              position={step}
              total={walkChapters.length}
              spotlight={spotlight}
              spotlightLocality={spotlightLocality}
              spotlightHref={spotlightHref}
              decadeRange={decadeRange}
              sweepDecade={sweepDecade}
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
