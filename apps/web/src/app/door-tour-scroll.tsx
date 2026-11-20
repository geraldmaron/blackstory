/**
 * The tour's scroll link: which stop is in front of the reader, and the rail that says so.
 *
 * Native scroll only. Two IntersectionObservers (no scroll listener, no per-frame state): one on
 * each step with a thin probe line across the screen, one on the whole tour. A step change sets a
 * ref and, once, tells the Door's camera (door-immersive.tsx listens for `DOOR_TOUR_EVENT`; it
 * owns the map window and the framing). Leaving the tour sends `null`, which sends the camera
 * back to the national frame. The current stop carries `data-current`, which is what shows its
 * words (door-tour.css). Focus is never moved: the stops are ordinary headings and links, and a
 * link reached by keyboard in a stop that is not showing scrolls that stop in.
 *
 * The rail is the chapter rail: one link per stop on the right edge, the current one named, and a
 * way past the tour. It stands where the opening's time rail stood.
 *
 * Without JavaScript none of this runs: the steps are a stacked list of records.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { PublicEntityPrimaryImageView } from '../data/public-seed';

void React;

export const DOOR_TOUR_EVENT = 'bs:door-tour';

/** What the camera needs to frame one step. `null` in the event means the tour is not in view. */
export type DoorTourTarget = {
  readonly pinId: string | null;
  readonly lngLat: readonly [number, number];
  readonly precision: string;
  /** The record's name and photograph, which the map lays over everything but the record's blocks. */
  readonly name: string;
  readonly plate?: PublicEntityPrimaryImageView;
  readonly person: boolean;
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
  const bandRef = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const band = bandRef.current;
    const tour = band?.closest<HTMLElement>('.ds-door-tour');
    if (!band || !tour || typeof IntersectionObserver === 'undefined') return undefined;

    const stepEls = [...tour.querySelectorAll<HTMLElement>('[data-tour-step]')];
    let active = false;
    let index: number | null = null;
    let published: number | null = null;
    const publish = () => {
      const next = active ? index : null;
      if (next === published) return;
      published = next;
      setCurrent(next);
      stepEls.forEach((el, at) => el.toggleAttribute('data-current', at === next));
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
      // A hidden or background tab can report no height; a negative line is an invalid margin.
      if (vh <= 0) return;
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
      stepEls.forEach((el) => stepObserver!.observe(el));
    };
    observeSteps();

    // The tour is "in view" from when its top reaches the probe line (so the first stop is
    // current the moment the opening gives way) until its end clears the top tenth.
    const tourObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        active = entry.isIntersecting;
        tour.dataset.active = active ? 'true' : 'false';
        publish();
      },
      { rootMargin: '-10% 0px -55% 0px', threshold: 0 },
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
    // Only the current stop's words show. A link reached by Tab in another stop brings its stop
    // in, so focus is never on something the reader cannot see.
    const onFocusIn = (event: FocusEvent) => {
      const stepEl = (event.target as HTMLElement).closest<HTMLElement>('[data-tour-step]');
      if (stepEl && !stepEl.hasAttribute('data-current')) stepEl.scrollIntoView({ block: 'start' });
    };
    tour.addEventListener('focusin', onFocusIn);
    return () => {
      tour.removeEventListener('focusin', onFocusIn);
      stepEls.forEach((el) => el.removeAttribute('data-current'));
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

  return (
    <nav className="ds-door-tour__rail" ref={bandRef} aria-label="Tour stops">
      <ol className="ds-door-tour__rail-stops">
        {steps.map((step, at) => (
          <li key={step.id}>
            <a
              className="ds-door-tour__rail-stop"
              href={`#${step.id}`}
              aria-current={current === at ? 'step' : undefined}
            >
              <span className="ds-door-tour__rail-label">
                <span className="ds-visually-hidden">{step.name}, </span>
                {step.label}
              </span>
              <span className="ds-door-tour__rail-dot" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
      <a className="ds-door-tour__skip" href="#door-ch-evidence-band">
        Skip the tour
      </a>
    </nav>
  );
}
