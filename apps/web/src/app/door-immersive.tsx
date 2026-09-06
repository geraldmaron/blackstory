/**
 * Door Immersive Journey: scroll chapters drive the camera of the shared map plate.
 *
 * One visit rolls chapters / facts / spotlight on the server so SSR and hydrate match.
 * Document scroll so the wheel works over the map; IntersectionObserver picks the chapter.
 *
 * THE MAP IS EXPLORE'S MAP, AND IT IS THE ONLY MAP HERE. The Door hands the persistent `MapStage`
 * the same national-field patch Explore rests on (`nationalFieldPatch`: grouped at national zoom,
 * the same style, the same entity markers) and flies its camera per chapter. There is no static
 * board underneath any more (repo-18ma2): a server-rendered Albers pin board fading into a Web
 * Mercator plate read as an old map replaced by a new one on every load. The field is the page's
 * own ground until the plate has painted, and then it is the plate.
 *
 * The camera is framed against the Door's map window (`.ds-door__window`: below the bar on a
 * desktop, the sticky strip on a phone), not against the whole canvas, and re-framed whenever that
 * window changes — a resize moves the map the way it moves the layout (door-field-frame.ts).
 *
 * Pins with public hrefs stay clickable: a marker or cluster on the live plate goes through the
 * stage's own `select` and cluster-expand paths.
 */
'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BRAND_ASSETS } from '@repo/config';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import type { StateDensityLevel } from '../lib/map-experience/density';
import { CAMERA_EASING_SLOW_OUT } from '../lib/map-experience/camera-presets';
import { CAMERA_FLY_CURVE } from '../lib/map-experience/camera-moves';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { nationalFieldPatch } from '../lib/map-experience/national-field';
import {
  earliestDecadeFor,
  sweep,
  SWEEP_CLEAR_HOLD_MS,
  type SweepHandle,
} from '../lib/map-experience/decade-transition';
import { DECADE_LAYER_FADE_MS } from './map/decade-layer-transition';
import type { StoryChapter } from '../lib/story/chapters';
import { chapterInViewFromRects, useChapterObserver } from '../lib/story/use-chapter-observer';
import type { StoryRecordSpotlight } from '../lib/story/pick-story-record';
import type { StoryFact } from '../lib/story/story-facts';
import { copyFor, headingParts } from '../components/story/story-copy';
import { HeroHeadlineMorph } from '../components/story/HeroHeadlineMorph';
import {
  PinPhotoLayer,
  type PinPhotoHoverTarget,
} from '../components/map-experience/PinPhotoLayer';
import { useMapStage } from '../components/map-stage/MapStage';
import { ABOUT_SUPPORT_LINE } from './about/about-copy';
import { resolveDoorFocus, type DoorFocusCamera, type DoorFocusFrame } from './door-focus';
import {
  doorFrameOffset,
  doorFramePadding,
  sameDoorFrameBox,
  type DoorFrameBox,
} from './door-field-frame';

void React;

const RECORD_CHAPTER_ID = 'one-record';

/** Same flight the Explore story mode gives a chapter (`use-story-runner.ts`). */
const CHAPTER_FLIGHT_MS = 1600;

/**
 * The decade range the sweep runs over, taken from the pins actually on the plate rather than
 * from the release's own first and last decade. The chapter's claim is about *this* field
 * filling up, so a decade with nothing on this plate is a frame with nothing to show.
 */
function sweepRange(
  pins: ExploreMapFeatureCollection,
): { readonly from: number; readonly to: number } | null {
  let from: number | null = null;
  let to: number | null = null;
  for (const feature of pins.features) {
    const decade = earliestDecadeFor(feature);
    if (decade === null) continue;
    if (from === null || decade < from) from = decade;
    if (to === null || decade > to) to = decade;
  }
  return from === null || to === null ? null : { from, to };
}

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
  readonly chrome: DoorFrameBox | null;
};

function sameDoorFrameBoxes(a: DoorFrameBoxes, b: DoorFrameBoxes): boolean {
  return (
    sameDoorFrameBox(a.window, b.window) &&
    sameDoorFrameBox(a.plate, b.plate) &&
    sameDoorFrameBox(a.chrome, b.chrome)
  );
}

const DOOR_COLD_OPEN_PROSE =
  'Every record in this archive is tied to a place you can stand in. Scroll to move the field. Grouped pins split as you get closer; any pin you can reach opens a record.';

type ChapterBody = {
  readonly prose: string;
  readonly figures: readonly { readonly value: string; readonly label: string }[] | undefined;
  readonly cite: string;
};

function chapterBody(
  chapter: StoryChapter,
  recordSpotlight: StoryRecordSpotlight | null,
  fact: StoryFact | undefined,
): ChapterBody | null {
  const copy = copyFor(chapter.id);
  if (!copy) return null;

  if (chapter.id === 'cold-open') {
    return { prose: DOOR_COLD_OPEN_PROSE, figures: copy.facts, cite: copy.cite };
  }

  if (chapter.id === RECORD_CHAPTER_ID && recordSpotlight) {
    const sources =
      recordSpotlight.evidenceCount === 1 ? '1 source' : `${recordSpotlight.evidenceCount} sources`;
    return {
      prose: `${recordSpotlight.name}, in ${recordSpotlight.place}. ${recordSpotlight.summary} It is one pin, and you can read its citations before you decide to trust it.`,
      figures: [
        { value: recordSpotlight.place, label: 'where' },
        { value: recordSpotlight.era, label: 'when' },
        { value: sources, label: 'evidence on the record' },
      ],
      cite: 'Drawn from the active release. Shown at the precision its sources support, and every citation opens on the record itself.',
    };
  }

  if (chapter.rotatingFact && fact) {
    return { prose: fact.prose, figures: fact.figures, cite: fact.source };
  }

  return { prose: copy.prose, figures: copy.facts, cite: copy.cite };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A Door pin's href is a public `/place/` or `/law` path, or the opaque `/door/pin/pin-N`
 * redirect that resolves an entity page without printing its id. The redirect is a server
 * answer, so it goes through a full navigation; the public paths are ordinary client routes.
 */
function openDoorPin(href: string, push: (href: string) => void): void {
  if (href.startsWith('/door/pin/')) {
    window.location.assign(href);
    return;
  }
  push(href);
}

/** What the field reports about the plate: nothing yet, this mount's frame landed, or no plate. */
type DoorPlateState = 'pending' | 'live' | 'unavailable';

export type DoorImmersiveProps = {
  readonly pins: ExploreMapFeatureCollection;
  /** Per-state presence tiers, so the plate opens on the same tint Explore does. */
  readonly densityLevels: readonly StateDensityLevel[];
  readonly chapters: readonly StoryChapter[];
  readonly factByChapterId: Readonly<Record<string, StoryFact>>;
  readonly spotlight: StoryRecordSpotlight | null;
  readonly spotlightLngLat: readonly [number, number] | null;
  /** Opaque `pin-N` for the spotlight, resolved on the server so the catalog stays off `/`. */
  readonly spotlightPinId: string | null;
  readonly placeCount: string;
};

export function DoorImmersive({
  pins,
  densityLevels,
  chapters,
  factByChapterId,
  spotlight,
  spotlightLngLat,
  spotlightPinId,
  placeCount,
}: DoorImmersiveProps) {
  const journeyRef = useRef<HTMLDivElement | null>(null);
  /** The map window: the part of the plate the reader sees on this surface (door-home.css). */
  const windowRef = useRef<HTMLDivElement | null>(null);
  /** The field chrome along the window's top edge; the country is framed below it. */
  const chromeRef = useRef<HTMLDivElement | null>(null);

  const stage = useMapStage();
  const router = useRouter();

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
   * Chapter 5 says "watch the record fill", so it has to be watchable: the plate crossdissolves
   * to an empty country, holds there, and then takes the archive back one decade at a time,
   * cumulatively. A cursor before the first decade matches nothing, which is the cleared frame.
   */
  const [sweepDecade, setSweepDecade] = useState<number | null>(null);
  const sweepRef = useRef<SweepHandle | null>(null);
  const stopSweep = useCallback(() => {
    sweepRef.current?.cancel();
    sweepRef.current = null;
    setSweepDecade(null);
  }, []);
  // Scrolling away mid-sweep, or leaving the Door entirely, must not strand a half-filled plate.
  useEffect(() => stopSweep, [stopSweep]);

  const decadeRange = useMemo(() => sweepRange(pins), [pins]);

  /** What the plate shows this frame: the whole field, or the archive as of the swept decade. */
  const sweptPins = useMemo<ExploreMapFeatureCollection>(() => {
    if (sweepDecade === null) return pins;
    return {
      ...pins,
      features: pins.features.filter((feature) => {
        const decade = earliestDecadeFor(feature);
        return decade !== null && decade <= sweepDecade;
      }),
    };
  }, [pins, sweepDecade]);

  /**
   * The one frame the plate crossdissolves rather than snapping: the cleared one. Removing
   * features from a GeoJSON source is otherwise instant, and a country's worth of pins vanishing
   * between frames reads as a fault rather than as the record being rewound. Every later frame
   * only adds pins, which the per-decade pin crossfade already covers.
   */
  const clearingPlate =
    sweepDecade !== null && (decadeRange === null || sweepDecade < decadeRange.from);
  const clearingPlateRef = useRef(clearingPlate);
  clearingPlateRef.current = clearingPlate;

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  /**
   * The chapter the plate is currently framing. The observer fires for the chapter already in
   * view too — on mount, and again when a fast scroll settles on the chapter it started from —
   * and re-resolving the same chapter would restart its flight (and, on the sweep chapter, the
   * sweep) for nothing. The opening chapter is framed on mount, so it starts as the last one.
   */
  const lastChapterIdRef = useRef<string>(chapters[0]!.id);

  /**
   * A page that mounts already scrolled — a reload, a restored history entry — frames the chapter
   * the reader is on before the plate's first frame, instead of framing the opening chapter and
   * then flying (repo-27uao). A layout effect, so it runs before the passive effects that land
   * the first frame, and after the sections have their boxes. The sweep chapter is left to the
   * observer: its camera is the national frame either way, and the sweep has to start from the
   * observer's own batch the way it does from a scroll.
   */
  useLayoutEffect(() => {
    const scope = journeyRef.current;
    if (!scope) return;
    const rects = [...scope.querySelectorAll<HTMLElement>('[data-chapter]')].map((section) => {
      const rect = section.getBoundingClientRect();
      return { chapterIndex: Number(section.dataset.chapter), top: rect.top, bottom: rect.bottom };
    });
    const index = chapterInViewFromRects(rects, window.innerHeight);
    const chapter = index === null ? undefined : chapters[index];
    if (!chapter || chapter.sweep || chapter.id === lastChapterIdRef.current) return;
    lastChapterIdRef.current = chapter.id;
    setFocus(
      resolveDoorFocus({
        chapter,
        spotlight,
        fact: factByChapterId[chapter.id],
        spotlightLngLat,
      }),
    );
  }, [chapters, factByChapterId, spotlight, spotlightLngLat]);

  useChapterObserver(
    journeyRef,
    chapters,
    useCallback(
      (chapter: StoryChapter) => {
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
          // so the reader actually sees the empty country the chapter is about. Under reduced
          // motion the plate clears in a cut and only the short beat is needed.
          clearHoldMs: calm ? SWEEP_CLEAR_HOLD_MS : DECADE_LAYER_FADE_MS + SWEEP_CLEAR_HOLD_MS,
          onDecade: setSweepDecade,
          // The last decade is not the end of the argument: the whole archive comes back, which
          // also returns every undated record the sweep had to leave out.
          onDone: () => setSweepDecade(null),
          reducedMotion: calm,
        });
      },
      [decadeRange, factByChapterId, spotlight, spotlightLngLat, stopSweep],
    ),
    // Document scroll: observe against the viewport, not a nested scrollport.
    { scrollRoot: 'document' },
  );

  const focusPinId =
    focus.focusEntityId !== null && spotlight !== null && focus.focusEntityId === spotlight.entityId
      ? spotlightPinId
      : null;

  /* —— The live plate ————————————————————————————————————————————————————————————————
     The same field Explore paints. `patchData` is also what wakes the shared plate on this
     surface (MapStage builds MapLibre on first contact), so the Door pays for the map exactly
     once, at the moment it asks for it, and shares the instance with `/explore` afterwards. */
  useEffect(() => {
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
   * stale on arrival: the plate is a persistent singleton (MapStage.tsx), and `subscribe`
   * replays the last viewport it ever reported — from whatever page was live before this one —
   * the instant this effect subscribes. Revealing the plate on that (door-home.css) would show
   * the previous page's camera for a frame. `framed` starts false on every mount and only flips
   * once the first frame below has actually been applied for this page's own chapter.
   */
  const [framed, setFramed] = useState(false);
  /** The first frame after mount is a cut, so a warm plate is never seen arriving from elsewhere. */
  const firstFrameRef = useRef(true);
  const cameraRef = useRef<DoorFocusCamera>(focus.camera);
  cameraRef.current = focus.camera;
  /** The boxes the last frame was computed against, so a resize only refits when they moved. */
  const lastFrameBoxesRef = useRef<DoorFrameBoxes>({ window: null, plate: null, chrome: null });
  const measureFrameBoxes = useCallback(
    (map: { getContainer(): HTMLElement }): DoorFrameBoxes => ({
      window: boxOf(windowRef.current),
      // MapLibre's own container: on the Door the whole viewport (posture `ambient`, shell.css).
      plate: boxOf(map.getContainer()),
      chrome: boxOf(chromeRef.current),
    }),
    [],
  );

  /**
   * Point the plate at the current frame, framed against the map window.
   *
   * A national chapter fits CONUS inside the window through the Atlas's own national preset,
   * with the window's insets as the fit's padding (`doorFramePadding`), so the country sits
   * below the bar and the field chrome on a desktop and inside the strip on a phone rather than
   * centered on a canvas the reader only partly sees. The strip is shorter than the country at the Instrument's
   * national zoom floor, so the fit may sink the floor to what it needs (`zoomFloor: 'fit'`,
   * camera.ts). Pitch and bearing are passed even though a national chapter
   * authors them as 0: scrolling back up from a tilted chapter has to be able to say "flat", or
   * the tilt and the turn survive the move (repo-lk7p8). A place chapter keeps the chapter's own
   * spec and lands the place at the window's center through `offset`.
   *
   * `cut` lands the frame in one step — the first frame after mount, and every refit after a
   * resize, where the plate has to keep step with a layout that does not animate its own reflow.
   */
  const applyCamera = useCallback(
    (cut: boolean): boolean => {
      const map = stage.getMap();
      if (!map) return false;
      const camera = cameraRef.current;
      const boxes = measureFrameBoxes(map);
      lastFrameBoxesRef.current = boxes;
      const { window: windowBox, plate: plateBox, chrome: chromeBox } = boxes;
      map.stop();
      if (isNationalCamera(camera)) {
        const padding =
          windowBox && plateBox ? doorFramePadding(windowBox, plateBox, chromeBox) : null;
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
        // Ambient: a scroll-driven move must stay suppressible under reduced motion.
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
    if (!applyCamera(firstFrameRef.current)) return;
    firstFrameRef.current = false;
    setFramed(true);
  }, [applyCamera, camera, plateLive]);

  /**
   * Re-frame when the map window or the canvas changes: a window resize, the bar wrapping, a
   * phone's toolbar collapsing (`100dvh`), the strip/full-bleed breakpoint. A cut, not a flight,
   * one per animation frame however many events a drag produces, and only when a box actually
   * moved — a sub-pixel jitter is not a resize (`sameDoorFrameBox`).
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
        applyCamera(true);
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

  /** The spotlight record's copper ring on the plate. */
  useEffect(() => {
    if (!plateLive) return;
    stage.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: focusPinId ?? undefined,
    });
  }, [focusPinId, plateLive, stage]);

  /** A marker click on the live plate opens the record the pin's href names. */
  const hrefByPinId = useMemo(() => {
    const byId = new Map<string, string>();
    for (const feature of pins.features) {
      const href = feature.properties.href;
      if (href.length > 0) byId.set(feature.properties.entityId, href);
    }
    return byId;
  }, [pins]);
  useEffect(
    () =>
      stage.subscribe('select', (entityId) => {
        const href = hrefByPinId.get(entityId);
        if (href) openDoorPin(href, (next) => router.push(next));
      }),
    [hrefByPinId, router, stage],
  );

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

  const scrollToChapter = useCallback(
    (index: number) => {
      const target = journeyRef.current?.querySelector(`[data-chapter="${index}"]`);
      target?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [reducedMotion],
  );

  const plateState: DoorPlateState = plateUnavailable ? 'unavailable' : framed ? 'live' : 'pending';

  return (
    <>
      <aside className="ds-door__field" aria-label="National pin field" data-plate={plateState}>
        {/* The map window. Measured for the camera frame (door-field-frame.ts); the plate shows
            through it once this mount has framed it. Nothing is drawn in it. */}
        <div className="ds-door__window" ref={windowRef} aria-hidden="true" />
        <div className="ds-door__field-chrome" ref={chromeRef}>
          {plateUnavailable ? (
            /* No plate here (no WebGL, or a context that could not be recovered). The pin count
               and the rotate hint would describe a map that is not there; say so once, where the
               map would be, and point at the index that needs no map. */
            <p className="ds-door__field-note" role="status">
              The map could not start in this browser.{' '}
              <Link href="/records">Browse the records</Link> instead.
            </p>
          ) : (
            <>
              <p className="ds-door__field-caption">
                <span className="ds-door__legend ds-door__legend--ink" aria-hidden="true" />
                {placeCount} places · click a pin
                <span className="ds-door__legend ds-door__legend--walk" aria-hidden="true" />
                walk
              </p>
              {/*
                Rotation is available here (`gesture-lock.ts`'s ambient posture hands `dragRotate`
                back on a precise pointer) but nothing said so, and the gesture a reader reaches
                for first is a trackpad twist, which no browser outside Safari reports to a page
                at all. Naming the modifier is the whole fix: shift plus a drag or a two-finger
                swipe.
              */}
              <p className="ds-door__field-caption ds-door__field-caption--gesture">
                shift + drag or swipe to turn the map
              </p>
            </>
          )}
        </div>
        <p className="ds-door__live" aria-live="polite">
          {focus.placeLabel}
        </p>
      </aside>

      <div className="ds-door-journey" id="door-journey" ref={journeyRef}>
        {chapters.map((chapter) => {
          const copy = copyFor(chapter.id);
          const body = chapterBody(chapter, spotlight, factByChapterId[chapter.id]);
          if (!copy || !body) return null;
          const { before, accent, after } = headingParts(copy);
          const isOpen = chapter.index === 0;
          const isClose = chapter.index === chapters.length - 1;
          const side = chapter.centered ? 'center' : chapter.index % 2 === 0 ? 'end' : 'start';
          const spotlightHref =
            chapter.id === RECORD_CHAPTER_ID && spotlight
              ? `/entity/${encodeURIComponent(spotlight.entityId)}`
              : null;

          return (
            <section
              key={chapter.id}
              id={isOpen ? 'door-open' : `door-chapter-${chapter.index}`}
              className={`ds-door-journey__chapter ds-door-journey__chapter--${side}${isOpen ? ' ds-door-journey__chapter--rest' : ''}`}
              data-chapter={chapter.index}
              aria-labelledby={`door-journey-heading-${chapter.id}`}
            >
              <div className="ds-door-journey__card">
                <div className="ds-door-journey__copy">
                  {isOpen ? (
                    <>
                      <p className="ds-door-journey__eyebrow">Place-connected archive</p>
                      <h1 id="door-brand" className="ds-door-journey__brand">
                        <span className="ds-door-journey__brand-sr">BlackStory</span>
                        <span className="ds-door-journey__lockup" aria-hidden="true">
                          {/* eslint-disable-next-line @next/next/no-img-element -- brand lockup */}
                          <img
                            className="ds-door-journey__lockup-img ds-door-journey__lockup-img--light"
                            src={BRAND_ASSETS.lockup.light}
                            alt=""
                            width={400}
                            height={102}
                            decoding="async"
                            fetchPriority="high"
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element -- brand lockup */}
                          <img
                            className="ds-door-journey__lockup-img ds-door-journey__lockup-img--dark"
                            src={BRAND_ASSETS.lockup.dark}
                            alt=""
                            width={400}
                            height={102}
                            decoding="async"
                          />
                        </span>
                      </h1>
                      <p className="ds-door-journey__support">History, pinned to place.</p>
                      <p className="ds-door-journey__pillars">{ABOUT_SUPPORT_LINE}</p>
                      <p className="ds-door-journey__presence">
                        <span className="ds-door-journey__presence-n">{placeCount}</span> places on
                        the field
                      </p>
                      <HeroHeadlineMorph
                        className="ds-door-journey__cold"
                        id={`door-journey-heading-${chapter.id}`}
                      />
                    </>
                  ) : (
                    <>
                      {chapter.centered ? null : (
                        <span className="ds-door-journey__index" aria-hidden="true">
                          {String(chapter.index).padStart(2, '0')}
                        </span>
                      )}
                      {copy.kicker ? (
                        <p className="ds-door-journey__kicker">{copy.kicker}</p>
                      ) : null}
                      <h2
                        className="ds-door-journey__heading"
                        id={`door-journey-heading-${chapter.id}`}
                      >
                        {before}
                        <em>{accent}</em>
                        {after}
                      </h2>
                    </>
                  )}

                  <p className="ds-door-journey__prose">{body.prose}</p>

                  {body.figures ? (
                    <dl className="ds-door-journey__facts">
                      {body.figures.map((figure) => (
                        <div key={`${figure.label}-${figure.value}`}>
                          <dt className="ds-door-journey__fact-value">{figure.value}</dt>
                          <dd className="ds-door-journey__fact-label">{figure.label}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  <p className="ds-door-journey__cite">{body.cite}</p>

                  {spotlightHref ? (
                    <p className="ds-door-journey__record">
                      <Link href={spotlightHref}>Open this record</Link>
                    </p>
                  ) : null}
                </div>

                {isOpen ? (
                  <div className="ds-door-journey__actions">
                    <button
                      type="button"
                      className="ds-cta ds-cta--copper"
                      onClick={() => scrollToChapter(1)}
                    >
                      Begin
                    </button>
                    <Link className="ds-cta ds-cta--quiet" href="/explore">
                      Skip to Explore
                    </Link>
                  </div>
                ) : null}

                {isClose ? (
                  <div className="ds-door-journey__actions">
                    <Link className="ds-cta ds-cta--copper" href="/explore">
                      Open Explore
                    </Link>
                    <Link className="ds-cta ds-cta--ink" href="/records">
                      Browse records
                    </Link>
                    <button
                      type="button"
                      className="ds-cta ds-cta--quiet"
                      onClick={() => scrollToChapter(0)}
                    >
                      Back to the start
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <PinPhotoLayer target={pinPhotoTarget} photosUrl="/door/photos" />
    </>
  );
}
