'use client';

/**
 * MapMoment — the plate, borrowed, inside a reading column.
 *
 * Design law: docs/ui/design-direction-v9-surfaces.md §4, patterns-reading-room.md.
 * Reference build: `.design-mocks/blackstory-atlas-v9.html`, the `decorateDoc` moment builder and
 * the `frameMoment` / `pickMoment` pair.
 *
 * WHY THIS IS IN THE KIT. The mock renders a moment in SEVEN rooms — chapter detail, /law,
 * /methodology, /data, /about, /memorial and /law/[slug] — and SP-22 built the room kit without
 * one. Six of those rooms had no owning package, so each would have invented its own moment
 * markup, which is the exact failure the kit exists to prevent. `room-kit.test.tsx` asserts no
 * route defines `.ds-mapmoment` markup of its own.
 *
 * IT DOES NOT OWN A MAP. There is one MapLibre instance on the site and a moment never creates a
 * second one. A moment contributes a *slot* — a 16:9 box at a known rect — and a caption. The
 * persistent plate is moved into the slot of whichever moment is currently live, in the Framed
 * posture. That move is SP-08's contract, not this component's.
 *
 * THE SEAM WITH SP-08. `MapMomentStage` owns exactly one question: which moment is live, and
 * where is its slot. It publishes that — rect, camera, `plain` flag — to any subscriber via
 * `useMapMomentFrame`, and never touches a map itself. SP-08's plate subscribes and moves into
 * the rect. Until it does, no stage is mounted, every moment stays idle, and the idle line says
 * the map is unavailable while the caption still carries the point, which is the degrade §10
 * already requires rather than a placeholder.
 *
 * THE CAPTION IS REQUIRED. `note` is a non-optional string. A moment whose plate fails, or whose
 * reader has the plate parked, must still make its point in text. A caption is the moment's
 * content; the map is its illustration.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '@repo/ui';

void React;

/* —— the camera ———————————————————————————————————————————————————————————— */

export type MapMomentCamera = {
  /** [lng, lat], matching MapLibre's order and the mock's `data-cam`. */
  readonly center: readonly [number, number];
  readonly zoom?: number;
  /** Refused on a plain moment. See {@link MapMomentProps.plain}. */
  readonly pitch?: number;
  /** Refused on a plain moment. */
  readonly bearing?: number;
};

/**
 * The camera a moment actually gets.
 *
 * A plain moment is a different composition, not a styling variant: the camera cuts rather than
 * flies, and pitch and bearing are dropped at this layer rather than by each call site agreeing
 * to behave. SP-26 derives `plain` from the subject's violence-adjacency and threads it into
 * `camera-dignity.ts`; this function is where the refusal is enforced for the moment slot, so a
 * caller cannot tilt a plain moment by passing a pitch.
 */
export function resolveMomentCamera(
  camera: MapMomentCamera,
  options: { readonly plain?: boolean; readonly reducedMotion?: boolean },
): {
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly pitch: number;
  readonly bearing: number;
  readonly move: 'cut' | 'fly';
} {
  const still = options.plain === true || options.reducedMotion === true;
  return {
    center: camera.center,
    zoom: camera.zoom ?? 9,
    pitch: still ? 0 : (camera.pitch ?? 0),
    bearing: still ? 0 : (camera.bearing ?? 0),
    move: still ? 'cut' : 'fly',
  };
}

/* —— arbitration ——————————————————————————————————————————————————————————— */

/** Below this share of a slot on screen, a moment does not take the plate. */
export const MOMENT_VISIBILITY_FLOOR = 0.55;

export type MomentCandidate = {
  readonly id: string;
  /** Slot rect in viewport coordinates. */
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
};

/**
 * Whether a slot is actually on screen, as opposed to merely having a rect.
 *
 * A rect is not enough, and the case that proves it is a moment inside a closed `<details>`:
 * Chrome collapses the drawer but keeps its contents laid out, so the slot still reports a
 * full-size rect at its old position. Arbitration then hands that slot the plate, and the
 * plate paints a map into a box the reader cannot see — directly over the prose that now
 * occupies the space. That is the "map bleeding through the text" failure, and it looks like
 * a z-order bug when it is really a visibility one.
 *
 * `checkVisibility` is the only check that catches it, because the drawer hides its content
 * with `content-visibility` rather than `display: none`. Browsers without it keep the old
 * rect-only behaviour rather than losing every moment.
 */
export function momentIsVisible(element: Element): boolean {
  const check = (
    element as Element & {
      checkVisibility?: (options?: {
        contentVisibilityAuto?: boolean;
        opacityProperty?: boolean;
        visibilityProperty?: boolean;
      }) => boolean;
    }
  ).checkVisibility;
  if (typeof check !== 'function') return true;
  return check.call(element, {
    contentVisibilityAuto: true,
    opacityProperty: true,
    visibilityProperty: true,
  });
}

/**
 * Which moment holds the plate, given where everything currently sits.
 *
 * Pure, because "a room with two moments has exactly one Framed plate at any scroll position" is
 * the acceptance criterion for this package and a scroll-driven DOM effect is not a thing a test
 * can pin down. /law, /methodology and chapter detail (four moments) are the reason the rule
 * exists; they are the test cases, not the edge cases.
 *
 * Ties go to the moment nearer the top of the document, so scrolling down through equally visible
 * moments hands the plate forward once rather than oscillating between them.
 */
export function pickLiveMoment(
  candidates: readonly MomentCandidate[],
  viewportHeight: number,
): string | null {
  let best: string | null = null;
  let bestVisibility = 0;

  for (const candidate of candidates) {
    if (candidate.height <= 0) continue;
    const onScreen =
      Math.max(0, Math.min(candidate.bottom, viewportHeight) - Math.max(candidate.top, 0)) /
      candidate.height;
    if (onScreen > MOMENT_VISIBILITY_FLOOR && onScreen > bestVisibility) {
      bestVisibility = onScreen;
      best = candidate.id;
    }
  }

  return best;
}

/* —— the stage ————————————————————————————————————————————————————————————— */

export type MomentFrame = {
  readonly id: string;
  readonly rect: DOMRect;
  readonly camera: MapMomentCamera;
  readonly plain: boolean;
};

type StageValue = {
  readonly liveId: string | null;
  readonly register: (id: string, entry: MomentRegistration) => () => void;
  readonly subscribe: (listener: (frame: MomentFrame | null) => void) => () => void;
};

type MomentRegistration = {
  readonly element: HTMLElement;
  readonly camera: MapMomentCamera;
  readonly plain: boolean;
};

const MapMomentStageContext = createContext<StageValue | null>(null);

export type MapMomentStageProps = {
  readonly children: ReactNode;
};

/**
 * Resolves which moment holds the plate, and publishes its slot rect to whoever is listening.
 *
 * Subscription rather than a callback prop, for two reasons. The rect changes on every scroll
 * frame, and routing that through React state would re-render the whole document column sixty
 * times a second to move one absolutely-positioned element. And a function prop on a component
 * exported across the `use client` boundary is not serializable, which Next is right to refuse.
 *
 * SP-08's plate calls {@link useMapMomentFrame} and positions itself. The stage never touches it.
 */
export function MapMomentStage({ children }: MapMomentStageProps) {
  const registry = useRef(new Map<string, MomentRegistration>());
  const listeners = useRef(new Set<(frame: MomentFrame | null) => void>());
  const [liveId, setLiveId] = useState<string | null>(null);
  const frameRef = useRef(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const register = useCallback((id: string, entry: MomentRegistration) => {
    registry.current.set(id, entry);
    // Child effects run before the parent's, so a moment can register before the observer
    // exists; the effect below observes whatever is already in the registry when it starts.
    observerRef.current?.observe(entry.element);
    return () => {
      observerRef.current?.unobserve(entry.element);
      registry.current.delete(id);
    };
  }, []);

  const subscribe = useCallback((listener: (frame: MomentFrame | null) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    // rAF-coalesced: scroll fires far more often than layout changes, and reading the rect of
    // every moment on every event is what makes a long chapter with four moments stutter.
    const sync = () => {
      frameRef.current = 0;
      const candidates: MomentCandidate[] = [];
      for (const [id, entry] of registry.current) {
        // A slot that is laid out but not visible (a collapsed drawer) is not a candidate:
        // see momentIsVisible. Skipping it here is what releases the plate rather than
        // leaving it painting into a box the reader cannot see.
        if (!momentIsVisible(entry.element)) continue;
        const rect = entry.element.getBoundingClientRect();
        candidates.push({ id, top: rect.top, bottom: rect.bottom, height: rect.height });
      }

      const next = pickLiveMoment(candidates, window.innerHeight);
      setLiveId(next);

      const entry = next === null ? undefined : registry.current.get(next);
      const frame: MomentFrame | null =
        next === null || entry === undefined
          ? null
          : {
              id: next,
              rect: entry.element.getBoundingClientRect(),
              camera: entry.camera,
              plain: entry.plain,
            };
      for (const listener of listeners.current) listener(frame);
    };

    const queue = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(sync);
    };

    // The first pick runs synchronously rather than through the rAF queue. A moment already on
    // screen at mount should be live in the first commit, not one frame later — and rAF does not
    // run at all while the document is hidden, so deferring the initial pick means a tab restored
    // from the background shows every moment idle until the reader happens to scroll.
    sync();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    // Same reason: scroll events that arrived while the tab was hidden were coalesced into an rAF
    // that never ran, so the moment the reader comes back is exactly when the pick is stale.
    document.addEventListener('visibilitychange', sync);
    // A drawer opening or closing moves every slot below it and changes whether its own slot is
    // visible at all, and it fires neither scroll nor resize. Without this the plate keeps the
    // rect it held when the drawer was open and goes on painting there. `toggle` does not bubble,
    // hence capture.
    document.addEventListener('toggle', queue, true);

    // Everything else that reflows the column without scrolling it: a hero image finishing its
    // load, a font swapping, a chart mounting. Observing the slots themselves rather than the
    // document keeps the callback count proportional to moments, not to page size.
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => queue());
    if (resizeObserver) {
      for (const entry of registry.current.values()) resizeObserver.observe(entry.element);
    }
    observerRef.current = resizeObserver;

    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('toggle', queue, true);
      resizeObserver?.disconnect();
      observerRef.current = null;
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        // Cleared, not just cancelled: `queue` treats a non-zero id as "a sync is already
        // pending" and would refuse to schedule another one for the life of the page.
        frameRef.current = 0;
      }
    };
  }, []);

  const value = useMemo<StageValue>(
    () => ({ liveId, register, subscribe }),
    [liveId, register, subscribe],
  );

  return <MapMomentStageContext.Provider value={value}>{children}</MapMomentStageContext.Provider>;
}

/**
 * Subscribe to the currently framed moment. SP-08's plate is the intended caller.
 *
 * Returns nothing: the listener is invoked with the slot rect on every scroll frame while a
 * moment is live, and with `null` when none is. Deliberately not React state — see the note on
 * {@link MapMomentStage}.
 */
export function useMapMomentFrame(listener: (frame: MomentFrame | null) => void): void {
  const stage = useContext(MapMomentStageContext);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!stage) return;
    return stage.subscribe((frame) => listenerRef.current(frame));
  }, [stage]);
}

/* —— the moment ———————————————————————————————————————————————————————————— */

export type MapMomentProps = {
  readonly camera: MapMomentCamera;
  /**
   * The point this moment makes, in words. Required: the caption is the content and the plate is
   * the illustration, so a moment must survive the plate being unavailable.
   */
  readonly note: string;
  /**
   * A violence-adjacent subject. The camera cuts instead of flying, holds locality precision, and
   * the tag reads STILL rather than LIVE. SP-26 derives this from the subject rather than leaving
   * it to each author, so a moment about violence cannot be dramatised by omission.
   */
  readonly plain?: boolean;
  /** Where "Open this view in Explore" goes. Omit to render no control. */
  readonly atlasHref?: string;
  /**
   * What the slot says while it is not holding the plate.
   *
   * The default suits a moment in a scrolling chapter, where the plate genuinely does arrive on
   * scroll. It is wrong in the two places where the plate is never coming: a record sheet floating
   * over the live Atlas (`framedClaimAllowed` refuses the claim there, deliberately) and any slot
   * on a Utility surface. Those callers pass their own line rather than telling the reader to
   * scroll for something that will not happen.
   *
   * Not a second component and not a variant flag: it is one string with a default, so the markup,
   * the arbitration and the degrade stay in one place.
   */
  readonly idle?: string;
  readonly className?: string;
};

export function MapMoment({
  camera,
  note,
  plain = false,
  atlasHref,
  idle,
  className,
}: MapMomentProps) {
  const stage = useContext(MapMomentStageContext);
  const slotRef = useRef<HTMLDivElement>(null);
  const reactId = useId();

  const register = stage?.register;
  useEffect(() => {
    const element = slotRef.current;
    if (!element || !register) return;
    return register(reactId, { element, camera, plain });
  }, [register, reactId, camera, plain]);

  // No stage mounted means no plate can be borrowed. That is the §10 degrade, not an error state:
  // the slot keeps its caption and says plainly that the map is not there.
  const plateAvailable = stage !== null;
  const live = plateAvailable && stage.liveId === reactId;

  return (
    <figure
      className={cx('ds-mapmoment', className)}
      data-live={live ? '1' : '0'}
      data-plain={plain ? '1' : undefined}
    >
      <div className="ds-mapmoment__plate" ref={slotRef}>
        <span className="ds-mapmoment__tag" aria-hidden="true">
          {plain ? 'Plate · Still' : 'Plate · Live'}
        </span>
        <div className="ds-mapmoment__idle">
          <span>
            {plateAvailable
              ? (idle ?? 'Scroll to bring the map here')
              : 'The map is unavailable. The caption below carries the point.'}
          </span>
        </div>
        {atlasHref === undefined ? null : (
          <a className="ds-mapmoment__open" href={atlasHref}>
            Open this view in Explore
          </a>
        )}
      </div>
      <figcaption className="ds-mapmoment__caption">{note}</figcaption>
    </figure>
  );
}
