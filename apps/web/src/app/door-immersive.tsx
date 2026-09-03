/**
 * Door Immersive Journey: scroll chapters drive the camera of the shared map plate.
 *
 * One visit rolls chapters / facts / spotlight on the server so SSR and hydrate match.
 * Document scroll so the wheel works over the map; IntersectionObserver picks the chapter.
 *
 * THE MAP IS EXPLORE'S MAP. The Door hands the persistent `MapStage` the same national-field
 * patch Explore rests on (`nationalFieldPatch`: grouped at national zoom, the same style, the
 * same entity markers) and flies its camera per chapter. The static Albers pin board underneath
 * is first paint and the no-JS / no-WebGL field: it hands over the moment the plate stamps
 * `data-plate-ready` (door-home.css). Until then the layout zoom on the board still tracks the
 * chapters, so a slow connection reads the same journey at lower fidelity rather than a blank.
 *
 * Pins with public hrefs stay clickable on both: the board's discs are links, and a marker or
 * cluster on the live plate goes through the stage's own `select` and cluster-expand paths.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useChapterObserver } from '../lib/story/use-chapter-observer';
import type { StoryRecordSpotlight } from '../lib/story/pick-story-record';
import type { StoryFact } from '../lib/story/story-facts';
import { copyFor, headingParts } from '../components/story/story-copy';
import { HeroHeadlineMorph } from '../components/story/HeroHeadlineMorph';
import {
  PinPhotoLayer,
  type PinPhotoHoverTarget,
} from '../components/map-experience/PinPhotoLayer';
import { usePinPhotoHoverAnchor } from '../components/map-experience/use-pin-photo-hover';
import { useMapStage } from '../components/map-stage/MapStage';
import { ABOUT_SUPPORT_LINE } from './about/about-copy';
import { resolveDoorFocus, type DoorFocusCamera, type DoorFocusFrame } from './door-focus';
import { FirstPaintPinPlate } from './first-paint-pin-plate';

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

  const pinFieldRef = useRef<HTMLElement | null>(null);
  const boardPhotoTarget = usePinPhotoHoverAnchor(pinFieldRef);

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

  useChapterObserver(
    journeyRef,
    chapters,
    useCallback(
      (chapter: StoryChapter) => {
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

  /** True once the plate has reported a viewport, which it only does after MapLibre `load`. */
  const [plateLive, setPlateLive] = useState(false);
  useEffect(() => stage.subscribe('viewport', () => setPlateLive(true)), [stage]);
  useEffect(() => stage.subscribe('error', () => setPlateLive(false)), [stage]);

  /**
   * True once THIS mount has pointed the shared plate at its own camera. `plateLive` alone is
   * stale on arrival: the plate is a persistent singleton (MapStage.tsx), and `subscribe`
   * replays the last viewport it ever reported — from whatever page was live before this one —
   * the instant this effect subscribes. Gating the board→plate handoff (door-home.css) on that
   * would swap to the live canvas while it is still showing the previous page's camera and data,
   * which is the map flash this state exists to prevent. `pageReady` starts false on every mount
   * and only flips once `flyTo` below has actually been issued for this page's own chapter.
   */
  const [pageReady, setPageReady] = useState(false);

  /** Chapter camera. The chapter's own MapLibre spec, flown the way the Explore story flies it. */
  const camera: DoorFocusCamera = focus.camera;
  useEffect(() => {
    if (!plateLive) return;
    const map = stage.getMap();
    if (!map) return;
    map.stop();
    /*
     * A national chapter frames the same field the Albers board draws: CONUS fitted to the
     * viewport through the Atlas's own national preset. A fixed zoom here (3.35) framed the
     * country smaller and higher than the board's contain-fit, so the board→plate handoff read
     * as a second, differently framed map arriving rather than the first one settling. Chapters
     * with a tilt or a place camera keep the chapter's own spec.
     */
    if (isNationalCamera(camera)) {
      stage.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
      setPageReady(true);
      return;
    }
    map.flyTo({
      center: [camera.center[0], camera.center[1]],
      zoom: camera.zoom,
      pitch: camera.pitch,
      bearing: camera.bearing,
      duration: reducedMotion ? 0 : CHAPTER_FLIGHT_MS,
      curve: CAMERA_FLY_CURVE,
      easing: CAMERA_EASING_SLOW_OUT,
      // Ambient: a scroll-driven move must stay suppressible under reduced motion.
      essential: false,
    } as never);
    setPageReady(true);
  }, [camera, plateLive, reducedMotion, stage]);

  /** The spotlight record's copper ring, on the plate as on the board. */
  useEffect(() => {
    if (!plateLive) return;
    stage.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: focusPinId ?? undefined,
    });
  }, [focusPinId, plateLive, stage]);

  /** A marker click on the live plate opens the record the board's link would have opened. */
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

  /** Pin photos rise from live markers exactly as they rise from the board's discs. */
  const [plateHoverTarget, setPlateHoverTarget] = useState<PinPhotoHoverTarget | null>(null);
  useEffect(
    () =>
      stage.subscribe('pinHover', (target) =>
        setPlateHoverTarget(
          target ? { key: target.entityId, name: target.name, rect: target.rect } : null,
        ),
      ),
    [stage],
  );
  const pinPhotoTarget = boardPhotoTarget ?? plateHoverTarget;

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

  /*
   * The static board's layout zoom (width/height/left/top), not transform: scale.
   * CSS scale rasterizes the masked locator + pins into a bitmap and looks soft when zoomed.
   * Growing the board in layout keeps the locator mask crisp. Only the field until the plate
   * is live; the plate's camera takes the same frame from `focus.camera`.
   */
  const boardStyle = {
    width: `${focus.scale * 100}%`,
    height: `${focus.scale * 100}%`,
    left: `calc(${focus.originX}% * (1 - ${focus.scale}))`,
    top: `calc(${focus.originY}% * (1 - ${focus.scale}))`,
    transition: reducedMotion
      ? 'none'
      : 'width 1.15s cubic-bezier(0.22, 1, 0.36, 1), height 1.15s cubic-bezier(0.22, 1, 0.36, 1), left 1.15s cubic-bezier(0.22, 1, 0.36, 1), top 1.15s cubic-bezier(0.22, 1, 0.36, 1)',
  } as const;

  return (
    <>
      <aside
        className="ds-door__field"
        aria-label="National pin field"
        ref={pinFieldRef}
        data-plate={plateLive ? 'live' : 'board'}
        data-page-ready={pageReady ? '1' : undefined}
      >
        <div className="ds-door__board-frame">
          <div className="ds-door__board-host">
            <div
              className={`ds-door__board${focus.scale > 1.05 ? ' is-zoomed' : ''}`}
              style={boardStyle}
            >
              <div className="ds-door__ground" aria-hidden="true">
                {/* Land colour via CSS mask (RecordLocator pattern); canvas shows through as field. */}
                <div className="ds-door__ground-map" />
              </div>
              <FirstPaintPinPlate pins={pins} linkRecords focusEntityId={focusPinId} />
            </div>
          </div>
        </div>
        <div className="ds-door__field-chrome">
          <p className="ds-door__field-caption">
            <span className="ds-door__legend ds-door__legend--ink" aria-hidden="true" />
            {placeCount} places · click a pin
            <span className="ds-door__legend ds-door__legend--walk" aria-hidden="true" />
            walk
          </p>
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
