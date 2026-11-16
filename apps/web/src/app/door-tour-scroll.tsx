/**
 * The tour's scroll link: which step is in front of the reader, and a visible echo of it.
 *
 * Native scroll only. Two IntersectionObservers (no scroll listener, no per-frame state): one on
 * each step with a thin probe line across the screen, one on the whole tour. A step change sets a
 * ref and, once, tells the Door's camera (door-immersive.tsx listens for `DOOR_TOUR_EVENT`; it
 * owns the map window and the framing). Leaving the tour sends `null`, which sends the camera
 * back to the national frame. Focus never moves: the map is decorative, the steps are ordinary
 * headings and links, and the progress mark is aria-hidden.
 *
 * Without JavaScript none of this runs: the steps are a stacked list of records.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';

void React;

export const DOOR_TOUR_EVENT = 'bs:door-tour';

/** What the camera needs to frame one step. `null` in the event means the tour is not in view. */
export type DoorTourTarget = {
  readonly pinId: string | null;
  readonly lngLat: readonly [number, number];
  readonly precision: string;
};

export type DoorTourStep = DoorTourTarget & {
  /** The step's section id. */
  readonly id: string;
  /** "Atlanta, Georgia": the progress mark's place. */
  readonly label: string;
};

/** Where the probe line sits: mid-screen on a phone, where each step's open map band passes; a
 * little above the middle on a wide screen. */
const PROBE_PHONE = 0.5;
const PROBE_WIDE = 0.45;

export function DoorTourScroll({ steps }: { readonly steps: readonly DoorTourStep[] }) {
  const bandRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const band = bandRef.current;
    const tour = band?.closest<HTMLElement>('.ds-door-tour');
    if (!band || !tour || typeof IntersectionObserver === 'undefined') return undefined;

    let active = false;
    let index: number | null = null;
    let published: number | null = null;
    const publish = () => {
      const next = active ? index : null;
      if (next === published) return;
      published = next;
      setCurrent(next);
      const step = next === null ? null : steps[next];
      window.dispatchEvent(new CustomEvent(DOOR_TOUR_EVENT, { detail: step ?? null }));
    };

    // Which steps cross the probe line, with how much of the line's band each one holds.
    const crossing = new Map<number, number>();
    let stepObserver: IntersectionObserver | null = null;
    const observeSteps = () => {
      stepObserver?.disconnect();
      crossing.clear();
      const vh = window.innerHeight;
      const phone = window.matchMedia(
        '(max-width: 47.9375rem), (max-width: 63.9375rem) and (max-aspect-ratio: 1/1)',
      ).matches;
      const line = Math.min(vh - 4, Math.round(vh * (phone ? PROBE_PHONE : PROBE_WIDE)));
      stepObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const at = Number((entry.target as HTMLElement).dataset.tourStep);
            if (entry.isIntersecting) crossing.set(at, entry.intersectionRect.height);
            else crossing.delete(at);
          }
          // No step on the line (a gap) keeps the last one; two on it (a seam) take the larger.
          let best: number | null = null;
          let most = -1;
          for (const [at, height] of crossing) {
            if (height > most) {
              best = at;
              most = height;
            }
          }
          if (best !== null && best !== index) {
            index = best;
            publish();
          }
        },
        { rootMargin: `-${line}px 0px -${Math.max(0, vh - line - 2)}px 0px`, threshold: 0 },
      );
      tour.querySelectorAll('[data-tour-step]').forEach((el) => stepObserver!.observe(el));
    };
    observeSteps();

    // The tour is "in view" from when its top clears the lower half of the screen until its end
    // clears the top tenth.
    const tourObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        active = entry.isIntersecting;
        tour.dataset.active = active ? 'true' : 'false';
        publish();
      },
      { rootMargin: '-10% 0px -45% 0px', threshold: 0 },
    );
    tourObserver.observe(tour);

    let frame: number | null = null;
    const onResize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        observeSteps();
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame !== null) window.cancelAnimationFrame(frame);
      stepObserver?.disconnect();
      tourObserver.disconnect();
      delete tour.dataset.active;
      if (published !== null) {
        window.dispatchEvent(new CustomEvent(DOOR_TOUR_EVENT, { detail: null }));
      }
    };
  }, [steps]);

  const step = current === null ? null : steps[current];
  return (
    <div className="ds-door-tour__band" ref={bandRef} aria-hidden="true">
      <p className="ds-door-tour__progress" hidden={step === null || step === undefined}>
        {step ? `${(current ?? 0) + 1} of ${steps.length} · ${step.label}` : null}
      </p>
    </div>
  );
}
