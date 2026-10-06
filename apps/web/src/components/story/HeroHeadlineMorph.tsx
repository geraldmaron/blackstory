'use client';

/**
 * Door cold-open headline subject morph: History splits into His Story (gap +
 * uppercase S), then the prefix crossfades through Her / Their / Your / Black
 * Story before holding. The prefix slot width interpolates so Story slides
 * instead of jumping. Trailer stays "happened *here*." Letter spans are
 * aria-hidden; the heading exposes the full accessible label.
 *
 * Paced by one timer per phase boundary, not a per-frame loop, and only while the heading is on
 * screen: Explore mounts the Door with its journey hidden, and a morph nobody can see was still
 * animating a width (a layout pass every frame) under the map for its first fifteen seconds.
 * Hidden or scrolled away, the headline settles on its final words at once.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/map-experience/camera-presets';
import {
  HERO_HEADLINE_FINAL_PHASE_ID,
  HERO_HEADLINE_PHASES,
  getHeroHeadlinePhaseById,
  getHeroHeadlinePhaseIndexById,
  heroHeadlinePhaseStartMs,
  historySplitHint,
  resolveHeroHeadlinePhaseIndex,
  storySuffix,
  type HeroHeadlinePhase,
} from '../../lib/story/hero-headline-morph';

const SPLIT_HINT = historySplitHint();
const STORY_TAIL = storySuffix().slice(1); // "tory"
const FINAL_INDEX = getHeroHeadlinePhaseIndexById(HERO_HEADLINE_FINAL_PHASE_ID);
const FINAL_PHASE = getHeroHeadlinePhaseById(HERO_HEADLINE_FINAL_PHASE_ID);

function inlinePaddingWidth(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  return Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
}

/** Survives React Strict Mode remount so the morph clock does not restart mid-sequence in dev. */
let morphSequenceStartedAt: number | null = null;

function readClientMotionPreference(): { readonly reduced: boolean; readonly phaseIndex: number } {
  if (typeof window === 'undefined') {
    return { reduced: false, phaseIndex: 0 };
  }
  const reduced = prefersReducedMotion();
  return { reduced, phaseIndex: reduced ? FINAL_INDEX : 0 };
}

/**
 * Crossfades prefix words while interpolating the slot width so the following
 * "Story" slides into place instead of snapping when word lengths differ.
 */
function MorphingPrefix({
  value,
  transitionMs,
  animate,
}: {
  readonly value: string;
  readonly transitionMs: number;
  readonly animate: boolean;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const inRef = useRef<HTMLSpanElement>(null);
  const previousRef = useRef(value);
  const [current, setCurrent] = useState(value);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [slotWidthPx, setSlotWidthPx] = useState<number | null>(null);
  const [widthTransition, setWidthTransition] = useState(false);

  useLayoutEffect(() => {
    if (value === previousRef.current) return undefined;

    const from = previousRef.current;
    previousRef.current = value;

    if (!animate) {
      setOutgoing(null);
      setCurrent(value);
      setSlotWidthPx(null);
      setWidthTransition(false);
      return undefined;
    }

    const fromWidth = rootRef.current?.getBoundingClientRect().width ?? 0;
    setOutgoing(from);
    setCurrent(value);
    setWidthTransition(false);
    setSlotWidthPx(fromWidth);

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        const incomingWidth = inRef.current?.getBoundingClientRect().width;
        const toWidth =
          incomingWidth !== undefined && rootRef.current
            ? incomingWidth + inlinePaddingWidth(rootRef.current)
            : fromWidth;
        setWidthTransition(true);
        setSlotWidthPx(toWidth);
      });
    });

    const timer = window.setTimeout(() => {
      setOutgoing(null);
      setSlotWidthPx(null);
      setWidthTransition(false);
    }, transitionMs);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [value, animate, transitionMs]);

  const durationStyle = { animationDuration: `${transitionMs}ms` };
  const slotStyle =
    slotWidthPx !== null
      ? {
          width: `${slotWidthPx}px`,
          transition: widthTransition
            ? `width ${transitionMs}ms var(--ds-hero-morph-ease)`
            : 'none',
        }
      : undefined;

  return (
    <span
      ref={rootRef}
      className="ds-hero-headline-morph__prefix"
      data-morphing={outgoing !== null ? 'true' : 'false'}
      style={slotStyle}
    >
      {outgoing !== null ? (
        <span className="ds-hero-headline-morph__prefix-out" style={durationStyle}>
          {outgoing}
        </span>
      ) : null}
      <span
        ref={inRef}
        className="ds-hero-headline-morph__prefix-in"
        style={outgoing !== null ? durationStyle : undefined}
      >
        {current}
      </span>
    </span>
  );
}

function subjectPrefix(phase: HeroHeadlinePhase): string {
  return phase.storySplit ? phase.prefix : SPLIT_HINT.before;
}

export function HeroHeadlineMorph({
  id,
  className,
}: {
  readonly id: string;
  readonly className: string;
}) {
  // SSR + first client render always start on History so markup hydrates cleanly.
  // Reduced-motion jumps to Black Story in useLayoutEffect (before paint).
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  /** The sequence stopped early because the heading left the screen: no more transitions. */
  const [settled, setSettled] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const next = readClientMotionPreference();
    setReducedMotion(next.reduced);
    if (next.reduced) {
      setPhaseIndex(FINAL_INDEX);
    }
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;

    if (morphSequenceStartedAt === null) {
      morphSequenceStartedAt = performance.now();
    }
    const startedAt = morphSequenceStartedAt;
    let timer = 0;
    let done = false;

    const step = () => {
      const elapsed = performance.now() - startedAt;
      const next = resolveHeroHeadlinePhaseIndex(elapsed, false);
      setPhaseIndex(next);
      if (next >= FINAL_INDEX) {
        done = true;
        return;
      }
      const nextStartMs = heroHeadlinePhaseStartMs(next + 1);
      timer = window.setTimeout(step, Math.max(0, nextStartMs - elapsed) + 1);
    };
    step();

    const heading = headingRef.current;
    let observer: IntersectionObserver | undefined;
    if (heading && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        if (done || entries.every((entry) => entry.isIntersecting)) return;
        done = true;
        window.clearTimeout(timer);
        setSettled(true);
        setPhaseIndex(FINAL_INDEX);
        observer?.disconnect();
      });
      observer.observe(heading);
    }

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [reducedMotion]);

  const phase = HERO_HEADLINE_PHASES[phaseIndex] ?? FINAL_PHASE;
  const split = phase.storySplit || reducedMotion;
  const prefix = subjectPrefix(phase);
  const animatePrefix = !reducedMotion && !settled && phase.storySplit && phase.id !== 'his-story';
  const splitMs = HERO_HEADLINE_PHASES[1]?.transitionMs ?? 1500;
  const prefixMs = phase.transitionMs > 0 ? phase.transitionMs : 700;

  return (
    <h2 ref={headingRef} className={className} id={id} aria-label={phase.accessibleLabel}>
      <span
        className="ds-hero-headline-morph"
        aria-hidden="true"
        data-phase={phase.id}
        data-settled={settled ? 'true' : undefined}
        data-split={split ? 'true' : 'false'}
        style={{
          ['--ds-hero-split-ms' as string]: `${splitMs}ms`,
          ['--ds-hero-prefix-ms' as string]: `${prefixMs}ms`,
        }}
      >
        <MorphingPrefix value={prefix} transitionMs={prefixMs} animate={animatePrefix} />
        <span className="ds-hero-headline-morph__gap" />
        <span className="ds-hero-headline-morph__story">
          <span className="ds-hero-headline-morph__s-slot">
            <span className="ds-hero-headline-morph__s">S</span>
          </span>
          <span className="ds-hero-headline-morph__tail">{STORY_TAIL}</span>
        </span>
      </span>
      <span className="ds-hero-headline-morph__trailer" aria-hidden="true">
        {' '}
        happened <em>here</em>.
      </span>
    </h2>
  );
}
