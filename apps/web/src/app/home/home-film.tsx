/**
 * The home page's film: the persistent map as the ground under the page, moved by the scroll.
 *
 * The page is complete without this (home-page.tsx). Once the plate is live this adds `data-film`
 * to the page, which pins each stop for two screens (home.css), and from then on a scroll
 * position is a camera: the country at the top, a dive into each stop's record, a rise only as
 * far as it takes for the next record to fit, and the country again after the last. The path is
 * door-tour-scrub.ts's arithmetic, unchanged; nothing is timed and nothing captures the wheel.
 *
 * Reduced motion and the reader's "Hold still" get no film: the stops stay a stacked document
 * and the camera cuts to the stop in the middle of the window.
 *
 * One passive scroll listener, coalesced to a frame, also says which stop's words show, rolls
 * the decade between two stops, and moves the time rail's playhead.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import { nationalFieldPatch } from '../../lib/map-experience/national-field';
import { holdStill } from '../../lib/map-experience/world-prefs';
import { useMapStage } from '../../components/map-stage/MapStage';
import { groundFrameFor } from '../../components/map-stage/RecordGround';
import { ORBIT_MAX_ZOOM } from '../map/explore-style';
import { doorFramePadding } from '../door-field-frame';
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
} from '../door-tour-scrub';

void React;

export type HomeFilmStop = {
  readonly id: string;
  readonly pinId: string | null;
  readonly lngLat: readonly [number, number];
  readonly precision: string;
  readonly decade: number;
  /** "Atlanta, Georgia": the rail's name for the stop. */
  readonly label: string;
  readonly name: string;
  readonly href: string;
  /** The trip to the next stop, in words computed from the two records; none after the last. */
  readonly leg: { readonly text: string; readonly to: string } | null;
};

/** How long the scroll rests before a landing gets its names and its aerial imagery. */
const REST_MS = 260;
/** The camera's eased follow of the scroll, as a time constant. */
const EASE_MS = 140;
/** The middle of the lower 48, a little east: where the lights are. */
const COUNTRY_CENTER = [-95.5, 38.3] as const;
const COUNTRY_SPAN_DEG = US_CONUS_BOUNDS[2] - US_CONUS_BOUNDS[0];
const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The country, edge to edge: as wide as the window, never so far out that the globe's edge shows
 * (the home page is a place, not a planet) or that the style drops its state lines.
 */
export function countryZoom(width: number, height: number): number {
  const fill = Math.log2((width * 0.96) / ((512 * COUNTRY_SPAN_DEG) / 360));
  // The globe's disc is about 512 * 2^z / (pi * cos(latitude)) pixels across.
  const limbFree = Math.log2((Math.hypot(width, height) * Math.PI * 0.79) / 512);
  return Math.max(fill, limbFree, ORBIT_MAX_ZOOM + 0.05);
}

function boxOf(element: Element | null) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HomeFilm({
  pins,
  densityLevels,
  stops,
}: {
  readonly pins: ExploreMapFeatureCollection;
  readonly densityLevels: readonly StateDensityLevel[];
  readonly stops: readonly HomeFilmStop[];
}) {
  const stage = useMapStage();
  const router = useRouter();
  const landingRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const legRef = useRef<HTMLSpanElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const [imagery, setImagery] = useState(false);
  const [plate, setPlate] = useState<'pending' | 'live' | 'unavailable'>('pending');
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    stage.patchData(nationalFieldPatch(pins, { densityLevels, satellite: imagery }));
  }, [densityLevels, imagery, pins, stage]);
  useEffect(() => stage.subscribe('viewport', () => setPlate('live')), [stage]);
  useEffect(() => stage.subscribe('error', () => setPlate('unavailable')), [stage]);
  // A light on this page is one record: no place counts over them, here or on the way down.
  useEffect(() => {
    stage.setPlaceTokens(false);
    return () => stage.setPlaceTokens(true);
  }, [stage]);

  // A pin opens its record.
  useEffect(() => {
    const hrefs = new Map(
      pins.features.map((pin) => [pin.properties.entityId, pin.properties.href] as const),
    );
    return stage.subscribe('select', (entityId) => {
      const href = hrefs.get(entityId);
      if (href) router.push(href);
    });
  }, [pins, router, stage]);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.ds-home');
    if (!page) return undefined;
    page.dataset.plate = plate;
    if (plate !== 'live') return undefined;

    const still = reducedMotion() || holdStill();
    if (!still) page.dataset.film = '';
    const stepEls = [...page.querySelectorAll<HTMLElement>('[data-tour-step]')];
    const first = stops[0]?.decade ?? 0;
    const last = stops[stops.length - 1]?.decade ?? first;

    let layout: TourLayout | null = null;
    let cameras: TourCameras | null = null;
    let shown: number | null | undefined;
    let marked: number | null | undefined;
    let leg = -1;
    let frame: number | null = null;
    let follow: number | null = null;
    let restTimer: number | null = null;
    let at: TourCamera | null = null;
    let target: TourCamera | null = null;
    let lastTick = 0;
    let lastScrollAt = 0;

    const build = (map: { getContainer(): HTMLElement }): TourCameras | null => {
      const plateBox = boxOf(map.getContainer());
      const landing = boxOf(landingRef.current);
      if (!plateBox || !landing) return null;
      const country: TourCamera = {
        center: COUNTRY_CENTER,
        zoom: countryZoom(plateBox.width, plateBox.height),
        pitch: 0,
        padding: NO_PADDING,
      };
      const padding = doorFramePadding(landing, plateBox) ?? NO_PADDING;
      return {
        opening: country,
        orbit: country,
        span: Math.min(plateBox.width, plateBox.height),
        stops: stops.map((stop) => {
          const ground = groundFrameFor(stop.precision, false);
          return { center: stop.lngLat, zoom: ground.zoom, pitch: ground.pitch, padding };
        }),
      };
    };

    const put = (camera: TourCamera) =>
      stage.flyPreset(
        'point',
        { center: [camera.center[0], camera.center[1]], zoom: camera.zoom },
        { mode: 'cut', pitch: camera.pitch, bearing: 0, padding: camera.padding },
      );

    const tick = (now: number) => {
      follow = null;
      if (!at || !target) return;
      const k = 1 - Math.exp(-(now - lastTick) / EASE_MS);
      lastTick = now;
      const step = easeTourCamera(at, target, k);
      at = step.camera;
      put(at);
      if (!step.arrived) follow = window.requestAnimationFrame(tick);
    };

    /** The stop in the middle of the window, when the stops are a stacked document. */
    const stopInView = (): number | null => {
      const middle = window.innerHeight / 2;
      const found = stepEls.findIndex((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top <= middle && rect.bottom >= middle;
      });
      return found === -1 ? null : found;
    };

    const sync = () => {
      frame = null;
      const map = stage.getMap();
      if (!map) return;
      cameras ??= build(map);
      if (!cameras) return;

      let camera: TourCamera | null | undefined;
      let words: number | null = null;
      let mark: number | null = null;
      let landed: HomeFilmStop | undefined;
      let traveling = false;
      if (still) {
        words = stopInView();
        mark = words;
        camera = words === null ? cameras.opening : cameras.stops[words];
        landed = words === null ? undefined : stops[words];
      } else {
        layout ??= measureTourLayout(page);
        const phase = layout ? tourPhase(window.scrollY, layout) : null;
        if (!phase?.active) camera = cameras.opening;
        else {
          camera = tourCameraAt(phase, cameras);
          words = phase.words;
          mark = tourMarkedStop(phase, stops.length);
          traveling = phase.from !== phase.to;
          landed = traveling ? undefined : stops[phase.from - 1];
          // The trip between two stops: where to, how far, and the decade rolling between them.
          const from = stops[phase.from - 1];
          const to = stops[phase.to - 1];
          const between = traveling && words === null && from && to ? phase.from - 1 : -1;
          if (between !== leg) {
            leg = between;
            hudRef.current?.toggleAttribute('data-on', leg !== -1);
            if (leg !== -1 && legRef.current && from?.leg) {
              legRef.current.textContent = `${from.leg.text} to ${from.leg.to}`;
            }
          }
          if (between !== -1 && rollRef.current && from && to) {
            const year = Math.round((from.decade + (to.decade - from.decade) * phase.t) / 10) * 10;
            const text = `${year}s`;
            if (rollRef.current.textContent !== text) rollRef.current.textContent = text;
          }
          // The rail's playhead: where the scroll is in time, between the first and last stop.
          const nearest = tourNearestStop(phase, stops.length);
          const here =
            from && to
              ? from.decade + (to.decade - from.decade) * phase.t
              : (stops[nearest ?? 0]?.decade ?? first);
          railRef.current?.style.setProperty(
            '--home-time',
            String(last > first ? (here - first) / (last - first) : 0),
          );
        }
        const active = Boolean(phase?.active);
        if (page.dataset.active !== String(active)) {
          page.dataset.active = String(active);
          if (!active && leg !== -1) {
            leg = -1;
            hudRef.current?.removeAttribute('data-on');
          }
        }
      }

      if (words !== shown) {
        shown = words;
        setCurrent(words);
        stepEls.forEach((el, i) => el.toggleAttribute('data-current', i === words));
      }
      if (mark !== marked) {
        marked = mark;
        stage.applyViewState({
          selectedState: undefined,
          selectedEdge: undefined,
          selectedEntity: (mark === null ? undefined : stops[mark]?.pinId) ?? undefined,
        });
      }

      // Names and aerial imagery belong to a landing at rest: none is placed or fetched for the
      // zooms the camera passes through. Imagery only where the stored precision is a site.
      if (restTimer !== null) window.clearTimeout(restTimer);
      restTimer = null;
      const wantsImagery = landed !== undefined && groundFrameFor(landed.precision, false).imagery;
      if (!wantsImagery) setImagery(false);
      stage.setMapLabels(false);
      if (landed) {
        const rested = () => {
          const wait = REST_MS - (performance.now() - lastScrollAt);
          if (wait > 0) {
            restTimer = window.setTimeout(rested, wait);
            return;
          }
          restTimer = null;
          stage.setMapLabels(true);
          if (wantsImagery) setImagery(true);
        };
        restTimer = window.setTimeout(rested, REST_MS);
      }

      if (!camera) return;
      map.stop();
      if (still || at === null) {
        at = camera;
        target = camera;
        put(camera);
      } else {
        target = camera;
        if (follow === null) {
          lastTick = performance.now();
          follow = window.requestAnimationFrame(tick);
        }
      }
    };

    const schedule = () => {
      lastScrollAt = performance.now();
      if (frame === null) frame = window.requestAnimationFrame(sync);
    };
    const onResize = () => {
      layout = null;
      cameras = null;
      at = null;
      schedule();
    };
    // A link reached by Tab in a stop that is not showing brings its stop in.
    const onFocusIn = (event: FocusEvent) => {
      const stepEl = (event.target as HTMLElement).closest<HTMLElement>('[data-tour-step]');
      if (!still && stepEl && !stepEl.hasAttribute('data-current')) {
        stepEl.scrollIntoView({ block: 'start' });
      }
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    page.addEventListener('focusin', onFocusIn);
    schedule();

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      page.removeEventListener('focusin', onFocusIn);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (follow !== null) window.cancelAnimationFrame(follow);
      if (restTimer !== null) window.clearTimeout(restTimer);
      stepEls.forEach((el) => el.removeAttribute('data-current'));
      delete page.dataset.film;
      delete page.dataset.active;
      stage.setMapLabels(true);
      stage.applyViewState({
        selectedState: undefined,
        selectedEdge: undefined,
        selectedEntity: undefined,
      });
    };
  }, [plate, stage, stops]);

  const first = stops[0]?.decade ?? 0;
  const span = (stops[stops.length - 1]?.decade ?? first) - first;

  return (
    <>
      {/* Where a landing frames its record: the part of the window a stop's scene leaves to the
          map (home.css). Measured only. */}
      <div className="ds-home__landing" ref={landingRef} aria-hidden="true" />
      {plate === 'unavailable' ? (
        <p className="ds-home__note" role="status">
          The map could not start in this browser. Everything on this page still works.
        </p>
      ) : null}

      {/* In transit: where the camera is going and how far, and the decade rolling toward the
          next stop's. Shown only while the camera travels between two stops. */}
      <div className="ds-home-hud" ref={hudRef} aria-hidden="true">
        <span className="ds-home-hud__roll" ref={rollRef} />
        <span className="ds-home-hud__leg" ref={legRef} />
      </div>

      {stops.length > 0 ? (
        <nav className="ds-home-rail" ref={railRef} aria-label="Journey stops, in time order">
          <ol className="ds-home-rail__stops">
            {stops.map((stop, i) => (
              <li
                key={stop.id}
                style={{ left: `${span > 0 ? ((stop.decade - first) / span) * 100 : 50}%` }}
              >
                <a
                  className="ds-home-rail__stop"
                  href={`#${stop.id}`}
                  aria-current={current === i ? 'step' : undefined}
                >
                  <span className="ds-home-rail__tick" aria-hidden="true" />
                  <span className="ds-home-rail__label">
                    {stop.decade}s<span className="ds-visually-hidden">, {stop.name}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <a className="ds-home-rail__skip" href="#home-country">
            Skip the journey
          </a>
        </nav>
      ) : null}
    </>
  );
}
