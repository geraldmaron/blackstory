/**
 * The retelling's camera: the persistent map as the ground under the six scenes, moved by the
 * scroll (docs/ui/DESIGN.md sections 7.5 and 9.7).
 *
 * The scenes are complete without this (retelling.tsx) and their layout and word change are CSS
 * (front.css). This adds three things: the camera (the country for a word scene, a landing on a
 * record's place, the tour's own dive and traverse between them, from `camera-path.ts`); the
 * rail's current scene; and, on the front page, landing a returning reader on the last scene.
 *
 * One passive scroll listener, coalesced to a frame. Nothing is timed and nothing captures the
 * wheel. Reduced motion and "Hold still" get no travel: the camera cuts to the scene in the
 * middle of the window.
 *
 * Privacy: a town the reader types or a device position reaches this file only as a camera
 * target in memory (`setTown`). It is never written to the URL, to storage or to a log. The one
 * thing stored is `ds-front-seen`, a flag with no value beyond "1".
 */
'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import type { ExploreMapFeatureCollection } from '../../lib/map-experience/build-explore-map-source';
import type { StateDensityLevel } from '../../lib/map-experience/density';
import { nationalFieldPatch } from '../../lib/map-experience/national-field';
import { holdStill } from '../../lib/map-experience/world-prefs';
import { useMapStage } from '../../components/map-stage/MapStage';
import { groundFrameFor } from '../../components/map-stage/ground-frame';
import { ORBIT_MAX_ZOOM } from '../map/explore-style';
import { framePadding } from './frame-padding';
import { easeTourCamera, type TourCamera } from './camera-path';
import {
  lapseSteps,
  retellingCameraAt,
  retellingPhase,
  type RetellingLayout,
  type RetellingSceneId,
} from './retelling-scenes';

void React;

/** A record scene's landing: where, how exactly, and which pin the map rings. */
export type RetellingStop = {
  readonly pinId: string | null;
  readonly lngLat: readonly [number, number];
  readonly precision: string;
  /** "Tallahassee, Florida". */
  readonly place: string;
};

/** The town scene's place, in memory only. */
export type RetellingTown = { readonly lngLat: readonly [number, number] };

const TownContext = createContext<(town: RetellingTown | null) => void>(() => undefined);
/** The town scene hands the camera its place through this. */
export const useSetRetellingTown = () => useContext(TownContext);

/** First-party flag: this browser has been through the opening. No value, no id, no expiry. */
export const FRONT_SEEN_KEY = 'ds-front-seen';

/** The camera's eased follow of the scroll, as a time constant. */
const EASE_MS = 140;
/** How long the scroll rests before a landing gets its place names. */
const REST_MS = 260;
/** The middle of the lower 48, a little east: where the lights are. */
const COUNTRY_CENTER = [-95.5, 38.3] as const;
const COUNTRY_SPAN_DEG = US_CONUS_BOUNDS[2] - US_CONUS_BOUNDS[0];
const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };
/** A town is framed with its surroundings, never at street level. */
const TOWN_ZOOM = 8;
/** The first screen's time-lapse, start to finish, and the beat before it starts. */
const LAPSE_MS = 4200;
const LAPSE_LEAD_MS = 500;

/** The country, edge to edge, never so far out that the style drops its state lines. */
function countryZoom(width: number, height: number): number {
  const fill = Math.log2((width * 0.96) / ((512 * COUNTRY_SPAN_DEG) / 360));
  const limbFree = Math.log2((Math.hypot(width, height) * Math.PI * 0.79) / 512);
  return Math.max(fill, limbFree, ORBIT_MAX_ZOOM + 0.05);
}

function boxOf(element: Element | null) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function seen(): boolean {
  try {
    return window.localStorage.getItem(FRONT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(FRONT_SEEN_KEY, '1');
  } catch {
    // Without storage the reader simply sees the opening again.
  }
}

export function RetellingFilm({
  pins,
  densityLevels,
  stops,
  sceneIds,
  returning,
  children,
}: {
  readonly pins: ExploreMapFeatureCollection;
  readonly densityLevels: readonly StateDensityLevel[];
  /** One entry per scene, in order: a landing for a record scene, null for the others. */
  readonly stops: readonly (RetellingStop | null)[];
  readonly sceneIds: readonly RetellingSceneId[];
  readonly returning: boolean;
  readonly children: React.ReactNode;
}) {
  const stage = useMapStage();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const landingRef = useRef<HTMLDivElement | null>(null);
  const townRef = useRef<RetellingTown | null>(null);
  const resyncRef = useRef<() => void>(() => undefined);
  const [plate, setPlate] = useState<'pending' | 'live' | 'unavailable'>('pending');
  /** Bumped when the reader presses "Hold still", so the effect below reads the new choice. */
  const [stillTick, setStillTick] = useState(0);

  // Every record is its own light here, never grouped into a place. Grouping also has the map
  // regroup the whole catalog on the main thread the first time the camera dives (about 440ms
  // at 4x CPU, measured), which is the one long task this page would otherwise have.
  //
  // The first screen counts the lights on by decade when the reader arrives at the top with
  // motion allowed (`lapseSteps`). Then the map starts dark so no light shows before its decade.
  const lapseRef = useRef<'idle' | 'armed' | 'done'>('idle');
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || holdStill();
    const arrivingAtTop = window.scrollY < window.innerHeight * 0.25 && !window.location.hash;
    const arm = lapseRef.current === 'idle' && !still && arrivingAtTop && !(returning && seen());
    if (arm) lapseRef.current = 'armed';
    const shown = arm ? { ...pins, features: [] } : pins;
    stage.patchData(nationalFieldPatch(shown, { densityLevels, clusteringEnabled: false }));
  }, [densityLevels, pins, returning, stage]);

  // The time-lapse itself: about four seconds, one step a decade, each record lit in the decade
  // it is first documented in. Leaving the first screen ends it with every light on.
  useEffect(() => {
    const root = rootRef.current;
    if (plate !== 'live' || lapseRef.current !== 'armed' || !root) return undefined;
    const yearEl = root.querySelector<HTMLElement>('[data-year]');
    const captionEl = root.querySelector<HTMLElement>('[data-year-caption]');
    const settledYear = yearEl?.textContent ?? '';
    const settledCaption = captionEl?.textContent ?? '';
    const steps = lapseSteps(pins.features.map((pin) => pin.properties.earliestDecade));
    const total = pins.features.length.toLocaleString('en-US');
    const full = nationalFieldPatch(pins, { densityLevels, clusteringEnabled: false });
    let step = 0;
    let timer: number | null = null;

    const finish = () => {
      if (lapseRef.current === 'done') return;
      lapseRef.current = 'done';
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      stage.patchData(full);
      if (yearEl) yearEl.textContent = settledYear;
      if (captionEl) captionEl.textContent = settledCaption;
    };
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.5) finish();
    };
    const advance = () => {
      const current = steps[step];
      if (!current) {
        finish();
        return;
      }
      const lit = current.order.map((index) => pins.features[index]!);
      stage.patchData(
        nationalFieldPatch({ ...pins, features: lit }, { densityLevels, clusteringEnabled: false }),
      );
      if (yearEl) yearEl.textContent = String(current.decade);
      if (captionEl) {
        captionEl.textContent = `${lit.length.toLocaleString('en-US')} of ${total} records first documented by the ${current.decade}s`;
      }
      step += 1;
      timer = window.setTimeout(advance, LAPSE_MS / steps.length);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    timer = window.setTimeout(advance, LAPSE_LEAD_MS);
    return finish;
  }, [densityLevels, pins, plate, stage]);
  useEffect(() => stage.subscribe('viewport', () => setPlate('live')), [stage]);
  useEffect(() => stage.subscribe('error', () => setPlate('unavailable')), [stage]);
  // A light here is one record: no place counts over them.
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

  // The shell's "Hold still" button stores the choice; this page follows it without a reload.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.ds-world-controls__button')) {
        window.setTimeout(() => setStillTick((tick) => tick + 1), 0);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // A returning reader lands on the last scene, with a link back to the start.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !returning || !seen() || window.location.hash) return;
    root.querySelector<HTMLElement>('[data-watch]')?.removeAttribute('hidden');
    root.querySelector<HTMLElement>('.ds-scene:last-of-type')?.scrollIntoView({ block: 'start' });
  }, [returning]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    root.dataset.plate = plate;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || holdStill();
    root.toggleAttribute('data-still', still);
    const sceneEls = [...root.querySelectorAll<HTMLElement>('.ds-scene')];
    const railEls = [...root.querySelectorAll<HTMLElement>('[data-rail]')];
    const lastScene = sceneEls.length - 1;

    let layout: RetellingLayout | null = null;
    let anchors: readonly TourCamera[] | null = null;
    let orbit: TourCamera | null = null;
    let span = 0;
    let current = -1;
    let marked: string | null | undefined;
    let frame: number | null = null;
    let follow: number | null = null;
    let restTimer: number | null = null;
    let at: TourCamera | null = null;
    let target: TourCamera | null = null;
    let lastTick = 0;
    let lastScrollAt = 0;

    const measure = (): RetellingLayout => ({
      screen: window.innerHeight,
      scenes: sceneEls.map((el) => ({
        top: el.getBoundingClientRect().top + window.scrollY,
        height: el.offsetHeight,
      })),
    });

    const build = (map: { getContainer(): HTMLElement }): boolean => {
      const plateBox = boxOf(map.getContainer());
      const landing = boxOf(landingRef.current);
      if (!plateBox || !landing) return false;
      const country: TourCamera = {
        center: COUNTRY_CENTER,
        zoom: countryZoom(plateBox.width, plateBox.height),
        pitch: 0,
        padding: NO_PADDING,
      };
      const padding = framePadding(landing, plateBox) ?? NO_PADDING;
      orbit = country;
      span = Math.min(plateBox.width, plateBox.height);
      anchors = sceneIds.map((id, i) => {
        const stop = stops[i];
        if (stop) {
          const ground = groundFrameFor(stop.precision, false);
          return { center: stop.lngLat, zoom: ground.zoom, pitch: ground.pitch, padding };
        }
        const town = id === 'your-story' ? townRef.current : null;
        return town ? { center: town.lngLat, zoom: TOWN_ZOOM, pitch: 0, padding } : country;
      });
      return true;
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

    const sync = () => {
      frame = null;
      layout ??= measure();
      let phase = retellingPhase(window.scrollY, layout);
      if (still) {
        // A stacked document: the scene in the middle of the window, and no travel.
        const middle = window.scrollY + window.innerHeight / 2;
        let index = 0;
        layout.scenes.forEach((scene, i) => {
          if (middle >= scene.top) index = i;
        });
        phase = { from: index, to: index, t: 0, current: index };
      }

      if (phase.current !== current) {
        current = phase.current;
        root.dataset.scene = sceneIds[current] ?? '';
        railEls.forEach((el, i) => {
          if (i === current) el.setAttribute('aria-current', 'step');
          else el.removeAttribute('aria-current');
        });
        // Keep the current name in sight on a narrow rail without moving the page.
        const link = railEls[current];
        const list = link?.closest('ol');
        // Centered where there is room; where the list is narrower than the word (a phone), the
        // word starts at the list's edge, never cut at its first letters.
        if (link && list) {
          const centered = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
          list.scrollLeft = Math.min(link.offsetLeft, centered);
        }
        if (current === lastScene) markSeen();
      }
      const traveling = phase.from !== phase.to;
      const to = traveling ? (sceneIds[phase.to] ?? '') : '';
      if (root.dataset.to !== to) root.dataset.to = to;

      // The camera waits for the map's own first frame: its style is not there before that.
      const map = plate === 'live' ? stage.getMap() : null;
      if (!map) return;
      if (!anchors && !build(map)) return;
      if (!anchors || !orbit) return;

      // The record the camera is on, or is coming down on, is ringed from the first frame.
      const mark = stops[traveling && phase.t >= 0.5 ? phase.to : phase.from]?.pinId ?? null;
      if (mark !== marked) {
        marked = mark;
        stage.applyViewState({
          selectedState: undefined,
          selectedEdge: undefined,
          selectedEntity: mark ?? undefined,
        });
      }

      // Place names belong to a landing at rest: none is placed for the zooms passed through.
      if (restTimer !== null) window.clearTimeout(restTimer);
      restTimer = null;
      stage.setMapLabels(false);
      if (!traveling) {
        const rested = () => {
          const wait = REST_MS - (performance.now() - lastScrollAt);
          if (wait > 0) {
            restTimer = window.setTimeout(rested, wait);
            return;
          }
          restTimer = null;
          stage.setMapLabels(true);
        };
        restTimer = window.setTimeout(rested, REST_MS);
      }

      const camera = retellingCameraAt(phase, anchors, { orbit, span });
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
    const remeasure = () => {
      layout = null;
      anchors = null;
      schedule();
    };
    const onResize = () => {
      at = null;
      remeasure();
    };
    // "Skip to the archive" counts as having been through the opening.
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('[data-skip]')) markSeen();
    };
    resyncRef.current = remeasure;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    root.addEventListener('click', onClick);
    // A scene's height changes when its photograph loads or the town answers.
    const observer = new ResizeObserver(remeasure);
    sceneEls.forEach((el) => observer.observe(el));
    schedule();

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      root.removeEventListener('click', onClick);
      observer.disconnect();
      resyncRef.current = () => undefined;
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (follow !== null) window.cancelAnimationFrame(follow);
      if (restTimer !== null) window.clearTimeout(restTimer);
      stage.setMapLabels(true);
      stage.applyViewState({
        selectedState: undefined,
        selectedEdge: undefined,
        selectedEntity: undefined,
      });
    };
  }, [plate, sceneIds, stage, stillTick, stops]);

  const setTown = useMemo(
    () => (town: RetellingTown | null) => {
      townRef.current = town;
      resyncRef.current();
    },
    [],
  );

  return (
    <div className="ds-retelling" ref={rootRef} data-scene={sceneIds[0]}>
      {/* Measured only: the part of the window a scene leaves to the map (front.css). */}
      <div className="ds-retelling__landing" ref={landingRef} aria-hidden="true" />
      <TownContext.Provider value={setTown}>{children}</TownContext.Provider>
      {plate === 'unavailable' ? (
        <p className="ds-retelling__note" role="status">
          The map could not start in this browser. Everything on this page still works.
        </p>
      ) : null}
    </div>
  );
}
