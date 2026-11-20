/**
 * The tour's words and rail: which stop is in front of the reader.
 *
 * Native scroll only, never captured. One passive scroll listener, coalesced to a frame, reads the
 * scroll position through the same pure path the camera uses (door-tour-scrub.ts), so the words
 * and the map cannot disagree: a stop's words show while the camera is landed on its record and
 * clear while it travels. The stop in front carries `data-current`, which is what shows its words
 * (door-tour.css); the tour carries `data-active` from the first pixel of the dive until the
 * camera is back on the opening's globe. The camera itself is door-immersive.tsx's.
 *
 * Focus is never moved: the stops are ordinary headings and links, and a link reached by keyboard
 * in a stop that is not showing scrolls that stop in. The rail is the chapter rail: one link per
 * stop on the right edge, the current one named, and a way past the tour. It stands where the
 * opening's time rail stood.
 *
 * Without JavaScript none of this runs: the stops are a stacked list of records.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { PublicEntityPrimaryImageView } from '../data/public-seed';
import { measureTourLayout, tourPhase, type TourLayout } from './door-tour-scrub';

void React;

/** One stop, as the rail and the camera need it. */
export type DoorTourTarget = {
  readonly pinId: string | null;
  readonly lngLat: readonly [number, number];
  readonly precision: string;
  readonly name: string;
  readonly plate?: PublicEntityPrimaryImageView;
  readonly person: boolean;
};

export type DoorTourStep = DoorTourTarget & {
  /** The step's section id. */
  readonly id: string;
  /** "Atlanta, Georgia": the rail's name for the stop. */
  readonly label: string;
};

export function DoorTourScroll({ steps }: { readonly steps: readonly DoorTourStep[] }) {
  const bandRef = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const band = bandRef.current;
    const tour = band?.closest<HTMLElement>('.ds-door-tour');
    if (!band || !tour) return undefined;
    const stepEls = [...tour.querySelectorAll<HTMLElement>('[data-tour-step]')];

    let layout: TourLayout | null = null;
    let shown: number | null = null;
    let active: boolean | null = null;
    let frame: number | null = null;
    const sync = () => {
      frame = null;
      layout ??= measureTourLayout(tour);
      if (!layout) return;
      const phase = tourPhase(window.scrollY, layout);
      if (phase.active !== active) {
        active = phase.active;
        tour.dataset.active = active ? 'true' : 'false';
      }
      if (phase.words !== shown) {
        shown = phase.words;
        setCurrent(shown);
        stepEls.forEach((el, at) => el.toggleAttribute('data-current', at === shown));
      }
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(sync);
    };
    const onResize = () => {
      layout = null;
      schedule();
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    schedule();

    // Only the current stop's words show. A link reached by Tab in another stop brings its stop
    // in, so focus is never on something the reader cannot see.
    const onFocusIn = (event: FocusEvent) => {
      const stepEl = (event.target as HTMLElement).closest<HTMLElement>('[data-tour-step]');
      if (stepEl && !stepEl.hasAttribute('data-current')) stepEl.scrollIntoView({ block: 'start' });
    };
    tour.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      tour.removeEventListener('focusin', onFocusIn);
      if (frame !== null) window.cancelAnimationFrame(frame);
      stepEls.forEach((el) => el.removeAttribute('data-current'));
      delete tour.dataset.active;
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
