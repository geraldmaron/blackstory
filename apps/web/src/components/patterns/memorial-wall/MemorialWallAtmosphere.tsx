/**
 * Full-canvas memorial wall atmosphere: handwritten names (with year of
 * record) packed without overlap, fading in and out. Decorative only
 * (aria-hidden, pointer-events: none) except for the small subset of names
 * that also have a real public entity page — those render as a real,
 * mouse-clickable link in a quiet copper accent (kept out of the tab order
 * since the wall stays aria-hidden; the full list is the accessible,
 * keyboard-reachable version of the same link). Readable roll lives in page
 * content.
 *
 * "Held in the Wall" opening sequence: the canvas is blank on mount, then
 * after a short beat names fade in sparse and build to full density within
 * the first viewport; only a capped subset is placed/rendered at once for
 * performance, and that subset rotates periodically so the full name pool
 * cycles through over a longer session. While that plays, an optional
 * message assembles clause by clause from the same handwriting mechanic and
 * holds permanently once fully shown, resting as a single paragraph block
 * (not stacked lines). A legibility backdrop sits behind it, and the wall
 * packer treats its bounding box as permanently occupied so no name can land
 * on top of it.
 *
 * Scroll behavior: ambient background names fade out with scroll progress
 * through the opening viewport (the held message does not fade).
 *
 * Placement is scoped to the opening screens (not the full document scroll
 * height): this element sits in normal flow near the top of the page
 * (`.ds-memorial-edition`, position: relative) and is pulled up by its own
 * document offset so it starts at the true viewport top, letting names run
 * behind the shell header and menu bar. Coordinates in
 * [0, viewportHeight * MEMORIAL_OPENING_SCREENS] land in the opening field and
 * scroll away naturally once the reader moves down to the full list, instead
 * of fighting that content for stacking order.
 */
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  MEMORIAL_HANDWRITING_FONT_VARS,
  MEMORIAL_NAMES,
  MEMORIAL_NAMES_REQUIRED,
  memorialNameYear,
} from './memorial-names';
import {
  packMemorialNames,
  type MemorialAvoidBox,
  type PlacedMemorialName,
} from './pack-memorial-names';
import {
  computeMemorialRevealState,
  memorialNameRevealThreshold,
  type MemorialRevealState,
} from './memorial-wall-reveal';
import './memorial-wall.css';

void React;

const CYCLE_SECONDS = 20;

/** Max names packed/rendered at once; keeps collision packing fast at 1,600+ names. */
const DENSITY_CAP = 220;

/** How often the on-screen subset rotates so the full pool cycles over a session. */
const SUBSET_ROTATE_MS = 45_000;

/** How often reveal/tick state is recomputed while the opening sequence plays. */
const REVEAL_TICK_MS = 200;

/**
 * How many viewports tall the wall is. Above 1 the names keep going past the
 * fold, so the opening reads as an open field rather than stopping dead where
 * the readable list begins. Must match `height: 125svh` in memorial-wall.css
 * and the opening block's reserved height in memorial-edition.css.
 */
const MEMORIAL_OPENING_SCREENS = 1.25;

/** Separator between name and year in the composite wall label; controls the split at render. */
const NAME_YEAR_SEPARATOR = ' · ';

export type MemorialWallAtmosphereProps = {
  readonly seedKey?: string;
  readonly names?: readonly string[];
  /** Optional message that assembles clause by clause from the wall and holds as one paragraph. */
  readonly messageLines?: readonly string[];
  /** Memorial name -> public entity id, for the small subset with a real entity page. */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
};

function hashSeed(seedKey: string, width: number, height: number): number {
  let h = 0x811c9dc5;
  const raw = `${seedKey}:${width}x${height}`;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a capped, rotation-seeded subset of `names`, always including required names. */
function selectWallSubset(
  names: readonly string[],
  required: readonly string[],
  cap: number,
  rotationSeed: number,
): readonly string[] {
  if (names.length <= cap) {
    return names;
  }
  const rng = createRng(rotationSeed);
  const requiredSet = new Set(required.filter((name) => names.includes(name)));
  const rest = names.filter((name) => !requiredSet.has(name));
  const shuffled = [...rest];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const remaining = Math.max(0, cap - requiredSet.size);
  return [...requiredSet, ...shuffled.slice(0, remaining)];
}

/** "Name" + year of record -> "Name · 1831" (bare name when year is unknown). */
function wallDisplayLabel(name: string): string {
  const year = memorialNameYear(name);
  return year ? `${name}${NAME_YEAR_SEPARATOR}${year}` : name;
}

/** Reverses `wallDisplayLabel`: splits the composite wall text back into name + year parts. */
function splitWallDisplayLabel(label: string): { readonly name: string; readonly year?: string } {
  const sep = label.lastIndexOf(NAME_YEAR_SEPARATOR);
  if (sep === -1) {
    return { name: label };
  }
  return { name: label.slice(0, sep), year: label.slice(sep + NAME_YEAR_SEPARATOR.length) };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Breathing room kept clear around the held message, in px. */
const MESSAGE_AVOID_MARGIN = 12;

/** Breathing room kept clear around the page's own title block, in px. */
const HEADER_AVOID_MARGIN = 16;

/**
 * Gap kept between the header's bottom edge and the held message's top edge,
 * in px. Deliberately not flush: this is the band where a name or two gets to
 * visibly appear above the message, so the opening screen reads as "title,
 * then a few names surfacing, then the held message" rather than the message
 * butting straight up against the title.
 */
const MESSAGE_TOP_GAP = 112;

/** Gap kept between the held message's bottom edge and the scroll cue below it, in px. */
const SCROLL_CUE_GAP = 40;

/** Breathing room kept clear around the scroll cue button, in px. */
const SCROLL_CUE_AVOID_MARGIN = 14;

/**
 * Anchors the scroll cue below the held message's measured bottom edge and
 * returns its resulting footprint in the wall's local coordinate space, so the
 * packer can treat the button as occupied ground.
 *
 * The cue lives outside this component's tree — a sibling of the wall under
 * `.ds-memorial-edition` (see page.tsx) — but the wall's left edge is flush
 * with that shared root's, so a box measured against the root converts to wall
 * coordinates by the same top-only shift used everywhere else here.
 *
 * Returns null when there is nothing to anchor to (no cue in the DOM, or the
 * message has not been laid out yet); the caller simply packs without the box
 * that pass and picks it up on the next rebuild.
 */
function positionScrollCue(
  root: HTMLElement,
  messageField: HTMLElement | null,
): MemorialAvoidBox | null {
  const container = root.parentElement;
  const scrollCue = container?.querySelector<HTMLElement>('.ds-memorial-edition__scroll-cue');
  const fieldBox = messageField?.getBoundingClientRect();
  const containerBox = container?.getBoundingClientRect();
  if (!scrollCue || !fieldBox || !containerBox || fieldBox.height === 0) {
    return null;
  }

  const top = fieldBox.bottom - containerBox.top + SCROLL_CUE_GAP;
  scrollCue.style.top = `${top}px`;

  /*
   * The cue is now at its real resting place rather than the 60vh CSS fallback.
   * Setting it is idempotent; the packer rebuilds on resize.
   */
  scrollCue.dataset.anchored = 'true';

  // Read back after the write so the box reflects the position just applied,
  // and so the cue's own size comes from the rendered pill rather than a guess
  // at its padding and label width.
  const rootBox = root.getBoundingClientRect();
  const cueBox = scrollCue.getBoundingClientRect();
  if (cueBox.width === 0 || cueBox.height === 0) {
    return null;
  }
  return {
    left: cueBox.left - rootBox.left - SCROLL_CUE_AVOID_MARGIN,
    right: cueBox.right - rootBox.left + SCROLL_CUE_AVOID_MARGIN,
    top: cueBox.top - rootBox.top - SCROLL_CUE_AVOID_MARGIN,
    bottom: cueBox.bottom - rootBox.top + SCROLL_CUE_AVOID_MARGIN,
  };
}

/**
 * Left and bottom edges of the page's RoomHeader (kicker/title/breadcrumb),
 * in the wall's local coordinate space (the wall's own left edge is flush
 * with `.ds-memorial-edition`'s, only its top is offset, so `left` here is
 * also directly usable by the scroll cue — see rebuild()). The header
 * renders outside this component's own tree as a sibling under the shared
 * `.ds-memorial-edition` root.
 */
function getHeaderBox(root: HTMLElement): { left: number; bottom: number } | null {
  const header = root.parentElement?.querySelector('.ds-room-header');
  if (!header) {
    return null;
  }
  const rootBox = root.getBoundingClientRect();
  const box = header.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) {
    return null;
  }
  return { left: box.left - rootBox.left, bottom: box.bottom - rootBox.top };
}

/**
 * Regions across the top of the canvas the packer must keep clear: the shell's
 * floating bar, and the page's own title block.
 *
 * Both are scoped to their actual rectangles rather than banded across the full
 * width. A full-width band from the canvas top to the bottom of the title was
 * the previous behaviour, and it wrote off the entire top fifth of the wall —
 * including the large open area to the right of the title, where there is
 * nothing to collide with. The names are the substance of this page and they
 * should use the space they have; only the two things a name would actually sit
 * on top of are reserved.
 */
function measureChromeAvoidBoxes(root: HTMLElement): readonly MemorialAvoidBox[] {
  const container = root.parentElement;
  const rootBox = root.getBoundingClientRect();
  const boxes: MemorialAvoidBox[] = [];

  // The shell bar is `position: fixed`, so it is only ever over the opening
  // screen — but that is exactly where the names are, and it spans the width.
  const bar = document.querySelector('.ds-bar');
  const barBox = bar?.getBoundingClientRect();
  if (barBox && barBox.height > 0) {
    boxes.push({
      left: -HEADER_AVOID_MARGIN,
      right: rootBox.width + HEADER_AVOID_MARGIN,
      top: -HEADER_AVOID_MARGIN,
      bottom: barBox.bottom - rootBox.top + HEADER_AVOID_MARGIN,
    });
  }

  const header = container?.querySelector('.ds-room-header');
  const headerBox = header?.getBoundingClientRect();
  if (headerBox && headerBox.width > 0 && headerBox.height > 0) {
    boxes.push({
      left: headerBox.left - rootBox.left - HEADER_AVOID_MARGIN,
      right: headerBox.right - rootBox.left + HEADER_AVOID_MARGIN,
      top: headerBox.top - rootBox.top - HEADER_AVOID_MARGIN,
      bottom: headerBox.bottom - rootBox.top + HEADER_AVOID_MARGIN,
    });
  }

  return boxes;
}

/**
 * Bounding box for the held message, measured from the rendered element so the
 * reserved footprint is the message's actual size. The estimate below is a
 * generous over-guess, and on a phone it walled off most of the canvas: the
 * packer then had almost nowhere to put a name and the wall came up empty.
 */
function measureMessageAvoidBox(
  root: HTMLElement,
  field: HTMLElement | null,
): MemorialAvoidBox | null {
  if (!field) {
    return null;
  }
  const rootBox = root.getBoundingClientRect();
  const box = field.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) {
    return null;
  }
  return {
    left: box.left - rootBox.left - MESSAGE_AVOID_MARGIN,
    right: box.right - rootBox.left + MESSAGE_AVOID_MARGIN,
    top: box.top - rootBox.top - MESSAGE_AVOID_MARGIN,
    bottom: box.bottom - rootBox.top + MESSAGE_AVOID_MARGIN,
  };
}

/**
 * Estimated bounding box for the held message, used only until the element
 * has been laid out. The message's top edge is anchored `MESSAGE_TOP_GAP`
 * below the header (see `--memorial-message-top`), not centered in the
 * viewport, so the estimate anchors from `topEdge` rather than the old
 * viewport-center guess.
 */
function estimateMessageAvoidBox(
  width: number,
  viewportHeight: number,
  topEdge: number,
): MemorialAvoidBox {
  const boxWidth = Math.min(width * 0.94, 46 * 16 + 64);
  const boxHeight = Math.min(viewportHeight * 0.4, 400);
  const cx = width / 2;
  return {
    left: cx - boxWidth / 2,
    right: cx + boxWidth / 2,
    top: topEdge,
    bottom: topEdge + boxHeight,
  };
}

export function MemorialWallAtmosphere({
  seedKey = 'memorial-edition-v6',
  names = MEMORIAL_NAMES,
  messageLines,
  entityLinksByName,
}: MemorialWallAtmosphereProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const measureCanvasRef = useRef<CanvasRenderingContext2D | null>(null);
  const resolvedFontsRef = useRef<Map<string, string> | null>(null);
  const [placements, setPlacements] = useState<readonly PlacedMemorialName[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  const [reveal, setReveal] = useState<MemorialRevealState>(() =>
    computeMemorialRevealState(0, { reducedMotion }),
  );

  const displayNames = useMemo(() => names.map(wallDisplayLabel), [names]);
  const requiredDisplayNames = useMemo(() => MEMORIAL_NAMES_REQUIRED.map(wallDisplayLabel), []);
  const hasMessage = Boolean(messageLines && messageLines.length > 0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measurer = measureRef.current;
    if (!root || !measurer) {
      return;
    }

    let rotation = 0;

    // Resolve each handwriting font's `var(--ds-font-hand-*)` custom property
    // to its concrete font-family string once (a handful of forced-layout
    // reads via the hidden measurer element), then measure every name with an
    // offscreen canvas's `measureText`. Canvas measurement never triggers a
    // page layout pass, so per-name measurement is O(1) and independent of
    // page DOM size — a DOM getBoundingClientRect measurer here previously
    // forced a synchronous layout of the *entire* page per name, which scales
    // with total DOM size (now ~1,700 names in the full readable list) and
    // was the dominant real-world cost, far more than the packing algorithm.
    const resolveFontFamily = (fontVar: string): string => {
      const cached = resolvedFontsRef.current?.get(fontVar);
      if (cached) {
        return cached;
      }
      measurer.style.fontFamily = fontVar;
      const resolved = window.getComputedStyle(measurer).fontFamily || fontVar;
      if (!resolvedFontsRef.current) {
        resolvedFontsRef.current = new Map();
      }
      resolvedFontsRef.current.set(fontVar, resolved);
      return resolved;
    };

    const getMeasureCtx = (): CanvasRenderingContext2D => {
      if (measureCanvasRef.current) {
        return measureCanvasRef.current;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('2D canvas context unavailable for memorial wall measurement');
      }
      measureCanvasRef.current = ctx;
      return ctx;
    };

    // Pack against the viewport, not full document scroll height: names only
    // need to be dense within the opening screen, and placing them there
    // (rather than spread across the much taller document) is what makes the
    // "sparse then building up" beat actually visible without scrolling.
    const rebuild = () => {
      const width = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const height = viewportHeight * MEMORIAL_OPENING_SCREENS;

      // The wall's flow position starts below the shell header. Expose that
      // document offset so the CSS can pull the layer back up to the true top
      // of the viewport (see --memorial-wall-offset-top), which is what lets
      // names run behind the header and menu bar.
      const offsetTop =
        root.getBoundingClientRect().top +
        window.scrollY +
        Number.parseFloat(root.style.getPropertyValue('--memorial-wall-offset-top') || '0');
      root.style.setProperty('--memorial-wall-offset-top', `${offsetTop}px`);

      // Anchor the held message a fixed gap below the header — not a
      // viewport-height percentage — so it sits just under the title on any
      // window height instead of drifting toward mid-screen on a tall
      // monitor. Also aligns it to the header's left edge instead of
      // centering it, matching the title's own alignment. Falls back to a
      // rough guess if the header hasn't rendered yet.
      const headerBox = getHeaderBox(root);
      const messageTopEdge = (headerBox?.bottom ?? viewportHeight * 0.22) + MESSAGE_TOP_GAP;
      const contentLeft = headerBox?.left ?? Math.max(16, width * 0.03);
      root.style.setProperty('--memorial-message-top', `${messageTopEdge}px`);
      // Set on the shared `.ds-memorial-edition` ancestor (not `root`, the
      // wall itself) so the scroll cue — a sibling of the wall, not a
      // descendant — inherits it too. The wall's own left edge is flush
      // with `.ds-memorial-edition`'s (only the top is pulled up), so this
      // one value lines up both elements.
      const editionRoot = root.parentElement;
      if (editionRoot instanceof HTMLElement) {
        editionRoot.style.setProperty('--memorial-content-left', `${contentLeft}px`);
      }

      // The real, keyboard-reachable scroll cue renders outside this
      // component's tree as another sibling under `.ds-memorial-edition`
      // (see page.tsx). Anchor it below the message's actual measured
      // footprint rather than pinning it to the bottom of the viewport, so
      // it reads as "the end of the paragraph" instead of a fixed dead zone.
      //
      // Placed *before* the names are packed, not after: the cue is an opaque
      // control sitting on the same canvas, so its footprint has to be one of
      // the avoid boxes below. Positioning it afterwards left the packer
      // unaware of it, and handwritten names surfaced behind the button.
      const scrollCueBox = hasMessage ? positionScrollCue(root, messageRef.current) : null;

      const subset = selectWallSubset(
        displayNames,
        requiredDisplayNames,
        DENSITY_CAP,
        hashSeed(seedKey, width, height) ^ rotation,
      );

      const ctx = getMeasureCtx();
      const next = packMemorialNames({
        names: subset,
        fonts: MEMORIAL_HANDWRITING_FONT_VARS,
        canvasWidth: width,
        canvasHeight: height,
        seed: hashSeed(seedKey, width, height) + rotation,
        cycleSeconds: CYCLE_SECONDS,
        // Fixed 14–28px reads oversized on phones; scale the range down so a
        // long handwritten name never spans most of a narrow canvas.
        fontSizeRange: width < 640 ? [11, 18] : width < 1024 ? [12, 22] : [14, 28],
        // Denser and less regimented than the defaults. At the default 60
        // attempts and a 10px gap only about a quarter of the requested names
        // found a spot, which left the field looking thin; the ±7° default
        // rotation also kept every name close enough to horizontal that they
        // read as rows rather than a scattered wall.
        boxGap: 7,
        maxAttempts: 200,
        rotationRangeDeg: 26,
        avoidBoxes: [
          ...measureChromeAvoidBoxes(root),
          hasMessage
            ? (measureMessageAvoidBox(root, messageRef.current) ??
              estimateMessageAvoidBox(width, viewportHeight, messageTopEdge))
            : null,
          scrollCueBox,
        ].filter((box): box is MemorialAvoidBox => box !== null),
        measure: (name, fontFamily, fontSizePx) => {
          ctx.font = `${fontSizePx}px ${resolveFontFamily(fontFamily)}`;
          const metrics = ctx.measureText(name);
          return { width: metrics.width, height: fontSizePx * 1.1 };
        },
      });
      setPlacements(next);
    };

    let resizeTimer: number | null = null;
    const scheduleResize = () => {
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(rebuild, 100);
    };

    const run = () => {
      if (document.fonts?.ready) {
        void document.fonts.ready.then(rebuild);
      } else {
        rebuild();
      }
    };

    run();
    window.addEventListener('resize', scheduleResize);

    // Full pool cycles: periodically rotate which capped subset is on screen.
    // Reduced motion skips this so the field stays still, per wall spec.
    let rotateTimer: number | null = null;
    if (!reducedMotion && displayNames.length > DENSITY_CAP) {
      rotateTimer = window.setInterval(() => {
        rotation += 1;
        rebuild();
      }, SUBSET_ROTATE_MS);
    }

    return () => {
      window.removeEventListener('resize', scheduleResize);
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
      if (rotateTimer !== null) {
        window.clearInterval(rotateTimer);
      }
    };
  }, [displayNames, requiredDisplayNames, seedKey, reducedMotion, hasMessage]);

  // Drive the opening-sequence clock: blank beat, then sparse-to-full density,
  // then message clauses assembling and holding. Reduced motion resolves once.
  useEffect(() => {
    if (reducedMotion) {
      setReveal(computeMemorialRevealState(0, { reducedMotion: true }));
      return;
    }
    const start = Date.now();
    setReveal(computeMemorialRevealState(0));
    const timer = window.setInterval(() => {
      setReveal(computeMemorialRevealState(Date.now() - start));
    }, REVEAL_TICK_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  // Ambient names fade out with scroll progress through the opening viewport;
  // the held message does not fade (see memorial-wall.css, message ignores
  // this custom property). Written directly to the DOM (not React state) so
  // scrolling never triggers a re-render.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) {
      return;
    }
    let ticking = false;
    const applyFade = () => {
      ticking = false;
      const span = Math.max(1, window.innerHeight * MEMORIAL_OPENING_SCREENS * 0.8);
      const fade = Math.max(0, 1 - window.scrollY / span);
      root.style.setProperty('--memorial-wall-fade', fade.toFixed(3));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(applyFade);
    };
    applyFade();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  const total = placements.length;
  const visiblePlacements = useMemo(
    () =>
      reducedMotion
        ? placements
        : placements.filter(
            (_, index) => memorialNameRevealThreshold(index, total) <= reveal.namesDensity,
          ),
    [placements, reveal.namesDensity, reducedMotion, total],
  );

  return (
    <div className="ds-memorial-wall" ref={rootRef} aria-hidden="true">
      <span className="ds-memorial-wall__measurer" ref={measureRef} />
      {visiblePlacements.map((item) => {
        const { name, year } = splitWallDisplayLabel(item.name);
        const entityId = entityLinksByName?.[name];
        return (
          <span
            key={`${item.name}-${item.cx.toFixed(1)}-${item.cy.toFixed(1)}`}
            className="ds-memorial-wall__name"
            style={
              {
                left: `${item.cx}px`,
                top: `${item.cy}px`,
                '--memorial-font': item.fontFamily,
                '--memorial-size': `${item.fontSizePx}px`,
                '--memorial-rot': `${item.rotationDeg}deg`,
                '--memorial-cycle': `${CYCLE_SECONDS}s`,
                '--memorial-delay': `${item.delaySeconds}s`,
                '--memorial-peak': String(item.peak),
              } as React.CSSProperties
            }
          >
            {entityId ? (
              <a href={`/entity/${entityId}`} className="ds-memorial-wall__name-link" tabIndex={-1}>
                {name}
              </a>
            ) : (
              name
            )}
            {year ? (
              <span className="ds-memorial-wall__name-year">{`${NAME_YEAR_SEPARATOR}${year}`}</span>
            ) : null}
          </span>
        );
      })}
      {messageLines && messageLines.length > 0 ? (
        <div className="ds-memorial-wall__message-field" role="note" ref={messageRef}>
          <div className="ds-memorial-wall__message-scrim" aria-hidden="true" />
          <p className="ds-memorial-wall__message">
            {messageLines.map((clause, index) => (
              <span
                key={clause.slice(0, 24)}
                className={`ds-memorial-wall__message-clause${
                  reveal.messageLinesShown[index] ? ' ds-memorial-wall__message-clause--shown' : ''
                }`}
              >
                {clause}
                {index < messageLines.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
