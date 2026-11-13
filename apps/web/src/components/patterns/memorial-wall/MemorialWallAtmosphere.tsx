/**
 * The memorial wall: a full-viewport field of handwritten names at three depths, drawn on one
 * canvas, with one name at a time brought forward and held.
 *
 * What it is for. A visitor should feel that they are standing in front of something larger than
 * the screen, read individual names as people, and then step closer to the full list. Every rule
 * below serves that:
 * - Names never vanish. Each rests at a faint trace, surfaces in a human hand, is held fully
 *   legible for several seconds, and rests again (memorial-wall-field.ts).
 * - Depth: far names small and faint; near names larger and brighter. The whole wall drifts
 *   upward very slowly, and names that leave the top return at the bottom as other names, so the
 *   full roll passes over a long visit without a counter or a progress mark.
 * - One name at a time comes forward in the center, with its year and place when the archive has
 *   them, and rests before the next.
 * - Attention is the only interaction. Where a pointer or finger rests, the wall steadies and the
 *   names under it come up and hold. Pressing a name brings it forward and keeps it there until
 *   the visitor presses elsewhere or presses Escape. Nothing is collected, counted or unlocked.
 * - Scrolling steps closer: the wall holds still, grows slightly and dims, while the inscription
 *   and then the list rise over it.
 *
 * Accessibility. The canvas and the rotating name are decorative (`aria-hidden`): announcing a
 * name every few seconds would be noise. The inscription is real text, and the alphabetical list
 * below (MemorialSections) is the complete, keyboard-reachable path to every name. Under
 * `prefers-reduced-motion` the wall is drawn once as a composed still, with a share of names fully
 * legible, and nothing drifts or cycles.
 *
 * Performance. One canvas, text drawn with `fillText` grouped by font, capped near 30 fps, and
 * paused while the tab is hidden or the wall is off screen. No per-name DOM, no layout reads per
 * frame; scroll writes one custom property.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../../lib/motion/use-reduced-motion';
import {
  MEMORIAL_HANDWRITING_FONT_VARS,
  MEMORIAL_NAMES,
  memorialNamePlace,
  memorialNameYear,
} from './memorial-names';
import { packMemorialNames, type MemorialAvoidBox } from './pack-memorial-names';
import {
  computeMemorialRevealState,
  MEMORIAL_MESSAGE_LINE_TIMES_MS,
  memorialNameRevealThreshold,
} from './memorial-wall-reveal';
import {
  attentionFalloff,
  hitTestMemorialWall,
  MEMORIAL_PRESENCE_HOLD_MS,
  MEMORIAL_PRESENCE_IN_MS,
  MEMORIAL_PRESENCE_OUT_MS,
  MEMORIAL_WALL_DRIFT_PX_PER_S,
  MEMORIAL_WALL_LAYERS,
  memorialNameAlpha,
  memorialNameStillAlpha,
  memorialWallSlot,
  wrapDrift,
  type MemorialWallHitTarget,
  type MemorialWallSlot,
} from './memorial-wall-field';
import './memorial-wall.css';

void React;

/** Faces legible enough to carry the one name brought forward. Homemade Apple stays on the wall. */
const PRESENCE_FONT_VARS = MEMORIAL_HANDWRITING_FONT_VARS.slice(0, 5);

/** Frame budget: the drift is a few px per second, so 30 fps is indistinguishable from 60. */
const FRAME_MS = 32;

/** Extra band above and below the viewport that names drift through before wrapping. */
const WRAP_MARGIN = 48;

/** A pointer that has not moved more than this many px for `REST_MS` is resting. */
const REST_SLOP_PX = 5;
const REST_MS = 320;

/** How far the scroll travels while the wall steps back, as a share of the viewport height. */
const STEP_CLOSER_SHARE = 0.4;

export type MemorialWallAtmosphereProps = {
  readonly seedKey?: string;
  readonly names?: readonly string[];
  /** The inscription, set as one line per sentence and revealed in order. */
  readonly messageLines?: readonly string[];
  /** Memorial name -> public entity id. Empty today by decision; see MemorialSections. */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
  /** The live `prefers-reduced-motion` read: a composed still wall, nothing drifts or cycles. */
  readonly held?: boolean;
};

function hashString(raw: string): number {
  let h = 0x811c9dc5;
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

function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function presenceFontFor(name: string): string {
  return PRESENCE_FONT_VARS[hashString(name) % PRESENCE_FONT_VARS.length]!;
}

function presenceMeta(name: string): string | undefined {
  const parts = [memorialNameYear(name), memorialNamePlace(name)].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

type WallName = {
  text: string;
  font: string;
  size: number;
  cos: number;
  sin: number;
  x: number;
  y0: number;
  width: number;
  halfW: number;
  halfH: number;
  layer: number;
  slot: MemorialWallSlot;
  still: number;
  threshold: number;
  wrap: number;
};

type Presence = {
  readonly index: number;
  readonly pinned?: string | undefined;
  readonly visible: boolean;
};

export function MemorialWallAtmosphere({
  seedKey = 'memorial-edition-v6',
  names = MEMORIAL_NAMES,
  messageLines,
  entityLinksByName,
  held: heldProp,
}: MemorialWallAtmosphereProps) {
  const held = Boolean(heldProp);
  const wallRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const presenceRef = useRef<HTMLDivElement | null>(null);
  const inscriptionRef = useRef<HTMLDivElement | null>(null);

  // The order names are brought forward in. Seeded so the server and first client render agree;
  // the starting point moves per visit once mounted.
  const order = useMemo(
    () => shuffled(names, createRng(hashString(`${seedKey}:presence`))),
    [names, seedKey],
  );
  const [presence, setPresence] = useState<Presence>({ index: 0, visible: false });
  const [linesShown, setLinesShown] = useState(0);
  const pinnedRef = useRef<string | undefined>(undefined);
  pinnedRef.current = presence.pinned;

  const presenceName = presence.pinned ?? order[presence.index % Math.max(1, order.length)] ?? '';
  const presenceRecord = entityLinksByName?.[presenceName];
  const meta = presenceName ? presenceMeta(presenceName) : undefined;
  const lineCount = messageLines?.length ?? 0;

  const pin = useCallback((name: string) => {
    setPresence((p) => ({ ...p, pinned: name, visible: false }));
  }, []);
  const release = useCallback(() => {
    setPresence((p) => (p.pinned ? { ...p, pinned: undefined, visible: false } : p));
  }, []);

  // Per-visit starting point into the roll.
  useEffect(() => {
    if (order.length > 1) {
      setPresence((p) => ({ ...p, index: Math.floor(Math.random() * order.length) }));
    }
  }, [order]);

  // The inscription arrives one sentence at a time and then stays.
  useEffect(() => {
    if (held) {
      setLinesShown(lineCount);
      return;
    }
    const timers = MEMORIAL_MESSAGE_LINE_TIMES_MS.slice(0, lineCount).map((ms, i) =>
      window.setTimeout(() => setLinesShown((n) => Math.max(n, i + 1)), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [held, lineCount]);

  // One name at a time: in, held, out, then the next. A pressed name stays until released.
  useEffect(() => {
    if (presence.pinned) {
      const t = window.setTimeout(
        () => setPresence((p) => ({ ...p, visible: true })),
        held ? 0 : 650,
      );
      return () => window.clearTimeout(t);
    }
    if (held) {
      setPresence((p) => ({ ...p, visible: true }));
      return;
    }
    let timer = 0;
    const show = () => {
      setPresence((p) => ({ ...p, visible: true }));
      timer = window.setTimeout(hide, MEMORIAL_PRESENCE_IN_MS + MEMORIAL_PRESENCE_HOLD_MS);
    };
    const hide = () => {
      setPresence((p) => ({ ...p, visible: false }));
      timer = window.setTimeout(() => {
        setPresence((p) => ({ ...p, index: p.index + 1 }));
        timer = window.setTimeout(show, 700);
      }, MEMORIAL_PRESENCE_OUT_MS);
    };
    timer = window.setTimeout(show, 2600);
    return () => window.clearTimeout(timer);
  }, [held, presence.pinned]);

  useEffect(() => {
    if (!presence.pinned) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') release();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presence.pinned, release]);

  // Scrolling steps closer: one custom property, read by CSS for the canvas scale and the fades.
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    let ticking = false;
    const apply = () => {
      ticking = false;
      const span = Math.max(1, window.innerHeight * STEP_CLOSER_SHARE);
      const depth = Math.min(1, Math.max(0, window.scrollY / span));
      wall.style.setProperty('--memorial-depth', depth.toFixed(3));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The field itself.
  useEffect(() => {
    const wall = wallRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wall || !canvas || !ctx) return;

    let disposed = false;
    let width = 0;
    let height = 0;
    let builtWidth = 0;
    let builtHeight = 0;
    let dpr = 1;
    let ink = '#0a0a0a';
    let items: WallName[] = [];
    let pool: string[] = [];
    let targets: MemorialWallHitTarget[] = [];
    let targetNames: string[] = [];
    let travelled = 0;
    let seconds = 0;
    let buildAt = 0;
    let families: string[] = [];
    let presenceClear = { cx: 0, cy: 0, rx: 0, ry: 0 };
    let inscriptionClear = { cx: 0, cy: 0, hw: 0, hh: 0 };

    const pointer = { x: 0, y: 0, inside: false, touch: false, lastMove: 0, att: 0 };

    const readInk = () => {
      ink = window.getComputedStyle(wall).color || ink;
    };

    const measureClearings = () => {
      const wallBox = wall.getBoundingClientRect();
      const p = presenceRef.current?.getBoundingClientRect();
      if (p && p.width > 0) {
        presenceClear = {
          cx: p.left - wallBox.left + p.width / 2,
          cy: p.top - wallBox.top + p.height / 2,
          rx: Math.min(wallBox.width * 0.48, p.width / 2 + 40),
          ry: p.height / 2 + 36,
        };
      }
      // The inscription scrolls with the stage while the wall stays put; measure it against the
      // stage so the clearing matches where it sits on the first screen.
      const stageBox = wall.parentElement?.getBoundingClientRect() ?? wallBox;
      const s = inscriptionRef.current?.getBoundingClientRect();
      if (s && s.width > 0) {
        inscriptionClear = {
          cx: s.left - stageBox.left + s.width / 2,
          cy: s.top - stageBox.top + s.height / 2,
          hw: s.width / 2 + 16,
          hh: s.height / 2 + 16,
        };
      }
    };

    const clearing = (x: number, y: number) => {
      let k = 1;
      if (presenceClear.rx > 0) {
        const e =
          ((x - presenceClear.cx) / presenceClear.rx) ** 2 +
          ((y - presenceClear.cy) / presenceClear.ry) ** 2;
        // Flat and nearly empty under the name, opening out toward the edge of the clearing.
        if (e < 1) k *= 0.05 + 0.95 * Math.max(0, (e - 0.55) / 0.45);
      }
      if (inscriptionClear.hw > 0) {
        const dx = Math.max(0, Math.abs(x - inscriptionClear.cx) - inscriptionClear.hw);
        const dy = Math.max(0, Math.abs(y - inscriptionClear.cy) - inscriptionClear.hh);
        const d = Math.hypot(dx, dy);
        if (d < 48) k *= 0.12 + 0.88 * (d / 48);
      }
      return k;
    };

    const fontCss = (size: number, family: string) => `${size}px ${family}`;

    const build = () => {
      const rng = createRng(hashString(`${seedKey}:${Math.round(width)}`));
      const narrow = width < 640 ? 0.66 : width < 1024 ? 0.8 : 1;
      // Smaller type on a narrow screen fits more names in the same area.
      const areaShare = Math.max(
        0.3,
        Math.min(1.4, (width * height) / (1440 * 900) / (narrow * narrow)),
      );
      const span = height + WRAP_MARGIN * 2;
      // Each visit starts somewhere else in the roll; the order itself stays seeded.
      const start = Math.floor(Math.random() * Math.max(1, names.length));
      const roll = shuffled(names, rng);
      pool = [...roll.slice(start), ...roll.slice(0, start)];

      const measure = (text: string, family: string, size: number) => {
        ctx.font = fontCss(size, family);
        return { width: ctx.measureText(text).width, height: size * 1.15 };
      };

      const placed: WallName[] = [];
      const avoid: MemorialAvoidBox[] = [];
      // Near first, so the far layer fills around the larger names in the still composition.
      for (let layerIndex = MEMORIAL_WALL_LAYERS.length - 1; layerIndex >= 0; layerIndex -= 1) {
        const layer = MEMORIAL_WALL_LAYERS[layerIndex]!;
        const ask = Math.round(layer.capacity * areaShare * 1.5);
        const subset = pool.splice(0, ask);
        const [lo, hi] = layer.fontSizeRange;
        const packed = packMemorialNames({
          names: subset,
          fonts: families,
          canvasWidth: width,
          canvasHeight: span,
          seed: hashString(`${seedKey}:${layer.id}:${Math.round(width)}`),
          fontSizeRange: [Math.round(lo * narrow), Math.round(hi * narrow)],
          rotationRangeDeg: 9,
          boxGap: layerIndex === 0 ? 10 : 18,
          maxAttempts: 80,
          avoidBoxes: avoid,
          measure,
        }).slice(0, Math.round(layer.capacity * areaShare));
        const used = new Set<string>();
        for (const item of packed) {
          used.add(item.name);
          const m = measure(item.name, item.fontFamily, item.fontSizePx);
          const rad = (item.rotationDeg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const halfW = (Math.abs(m.width * cos) + Math.abs(m.height * sin)) / 2;
          const halfH = (Math.abs(m.width * sin) + Math.abs(m.height * cos)) / 2;
          avoid.push({
            left: item.cx - halfW,
            right: item.cx + halfW,
            top: item.cy - halfH,
            bottom: item.cy + halfH,
          });
          const slot = memorialWallSlot(layerIndex, rng(), rng());
          placed.push({
            text: item.name,
            font: item.fontFamily,
            size: item.fontSizePx,
            cos,
            sin,
            x: item.cx,
            y0: item.cy - WRAP_MARGIN,
            width: m.width,
            halfW,
            halfH,
            layer: layerIndex,
            slot,
            still: memorialNameStillAlpha(slot, rng()),
            threshold: 0,
            wrap: 0,
          });
        }
        pool.push(...subset.filter((name) => !used.has(name)));
      }
      // Intro order is random across depths, then draw order is grouped by font so the canvas
      // switches fonts a handful of times per frame instead of once per name.
      const intro = shuffled(placed, rng);
      intro.forEach((item, index) => {
        item.threshold = memorialNameRevealThreshold(index, intro.length);
      });
      items = placed.sort(
        (a, b) => a.layer - b.layer || (a.font < b.font ? -1 : 1) || a.size - b.size,
      );
      targets = [];
      builtWidth = width;
      builtHeight = height;
      travelled = 0;
      measureClearings();
    };

    // Names leaving the top return at the bottom as the next names in the roll, when one fits.
    const swapOnWrap = (item: WallName) => {
      for (let tries = 0; tries < 8 && pool.length > 0; tries += 1) {
        const next = pool.shift()!;
        ctx.font = fontCss(item.size, item.font);
        const w = ctx.measureText(next).width;
        // Fits inside the slot's own gap, so the packed layout stays clear of overlaps.
        if (w <= item.width + 8 && next !== pinnedRef.current) {
          pool.push(item.text);
          item.text = next;
          return;
        }
        pool.push(next);
      }
    };

    const draw = (now: number) => {
      const span = builtHeight + WRAP_MARGIN * 2;
      const density = held ? 1 : computeMemorialRevealState(now - buildAt).namesDensity;
      const pinned = pinnedRef.current;
      const radius = Math.max(110, Math.min(200, width * 0.14));
      const att = held ? 0 : pointer.att;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let currentFont = '';
      const nextTargets: MemorialWallHitTarget[] = [];
      const nextTargetNames: string[] = [];

      for (const item of items) {
        const layer = MEMORIAL_WALL_LAYERS[item.layer]!;
        const y = held ? item.y0 : wrapDrift(item.y0, travelled, span, WRAP_MARGIN);
        if (!held) {
          const wrap = Math.floor((item.y0 + WRAP_MARGIN - travelled) / span);
          if (wrap !== item.wrap) {
            item.wrap = wrap;
            if (item.text !== pinned) swapOnWrap(item);
          }
        }
        if (y < -item.halfH || y > height + item.halfH) continue;

        let alpha = held ? item.still : memorialNameAlpha(item.slot, seconds);
        if (!held) {
          const intro = Math.min(1, Math.max(0, (density - item.threshold) / 0.12));
          alpha *= intro;
        }
        if (att > 0.001 && pointer.inside) {
          const f = attentionFalloff(Math.hypot(item.x - pointer.x, y - pointer.y), radius) * att;
          const lifted = Math.max(alpha, layer.peak);
          alpha += (lifted - alpha) * f;
        }
        alpha *= clearing(item.x, y);
        if (pinned && item.text === pinned) alpha = Math.max(alpha, 0.92);
        if (alpha < 0.004) continue;

        const font = fontCss(item.size, item.font);
        if (font !== currentFont) {
          ctx.font = font;
          currentFont = font;
        }
        ctx.globalAlpha = alpha;
        ctx.setTransform(
          dpr * item.cos,
          dpr * item.sin,
          -dpr * item.sin,
          dpr * item.cos,
          dpr * item.x,
          dpr * y,
        );
        ctx.fillText(item.text, 0, 0);
        nextTargets.push({
          x: item.x,
          y,
          halfWidth: item.halfW,
          halfHeight: item.halfH,
          layer: item.layer,
          alpha,
        });
        nextTargetNames.push(item.text);
      }
      targets = nextTargets;
      targetNames = nextTargetNames;
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const box = wall.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;
      width = box.width;
      height = box.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      return true;
    };

    // ---- the loop --------------------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let onScreen = true;
    const running = () => !held && onScreen && !document.hidden && items.length > 0 && !disposed;

    const frame = (now: number) => {
      raf = 0;
      if (!running()) return;
      raf = window.requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const resting = pointer.inside && (pointer.touch || now - pointer.lastMove > REST_MS);
      const target = resting ? 1 : 0;
      pointer.att += (target - pointer.att) * Math.min(1, dt / (target > pointer.att ? 0.5 : 1.1));

      // A hand on the wall steadies it.
      const pace = 1 - 0.88 * pointer.att;
      seconds += dt * (1 - 0.6 * pointer.att);
      travelled += MEMORIAL_WALL_DRIFT_PX_PER_S * dt * pace;
      draw(now);

      if (!pointer.touch && pointer.inside) {
        const over = hitTestMemorialWall(targets, pointer.x, pointer.y) >= 0;
        const cursor = over ? 'pointer' : '';
        if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
      }
    };
    const start = () => {
      if (raf === 0 && running()) {
        last = performance.now();
        raf = window.requestAnimationFrame(frame);
      }
    };
    const redrawStill = () => {
      if (held && items.length > 0) draw(performance.now());
    };

    const rebuildIfNeeded = () => {
      if (!resize()) return;
      measureClearings();
      const widthChanged = Math.abs(width - builtWidth) > 1;
      const heightChanged = Math.abs(height - builtHeight) > builtHeight * 0.2;
      if (items.length === 0 || widthChanged || heightChanged) build();
      if (held) redrawStill();
      else draw(performance.now());
    };

    // ---- fonts, then the first build ------------------------------------------------------
    const wallStyle = window.getComputedStyle(wall);
    families = MEMORIAL_HANDWRITING_FONT_VARS.map((fontVar) => {
      const name = /--[\w-]+/.exec(fontVar)?.[0] ?? '';
      return wallStyle.getPropertyValue(name).trim() || 'cursive';
    });
    readInk();
    const fontsReady = document.fonts
      ? Promise.all(
          families.map((family) => document.fonts.load(`24px ${family}`).catch(() => [])),
        ).catch(() => [])
      : Promise.resolve([]);
    void fontsReady.then(() => {
      if (disposed) return;
      buildAt = performance.now();
      rebuildIfNeeded();
      start();
    });

    // ---- observers -------------------------------------------------------------------------
    let resizeTimer = 0;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (families.length > 0 && buildAt > 0) rebuildIfNeeded();
      }, 150);
    });
    resizeObserver.observe(wall);

    const intersection = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      start();
    });
    intersection.observe(wall);

    const onVisibility = () => start();
    document.addEventListener('visibilitychange', onVisibility);

    const themeObserver = new MutationObserver(() => {
      readInk();
      redrawStill();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });

    // ---- attention -------------------------------------------------------------------------
    const local = (event: PointerEvent | MouseEvent) => {
      const box = canvas.getBoundingClientRect();
      // The canvas scales as the visitor scrolls; map back into wall coordinates.
      const sx = width / Math.max(1, box.width);
      const sy = height / Math.max(1, box.height);
      return { x: (event.clientX - box.left) * sx, y: (event.clientY - box.top) * sy };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const p = local(event);
      pointer.inside = true;
      pointer.touch = false;
      if (Math.hypot(p.x - pointer.x, p.y - pointer.y) > REST_SLOP_PX) {
        pointer.x = p.x;
        pointer.y = p.y;
        pointer.lastMove = performance.now();
      }
      // The still wall has no loop to update the cursor from.
      if (held) {
        canvas.style.cursor = hitTestMemorialWall(targets, p.x, p.y) >= 0 ? 'pointer' : '';
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      const p = local(event);
      Object.assign(pointer, { ...p, inside: true, touch: true, lastMove: 0 });
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.type === 'pointerleave') {
        pointer.inside = false;
        pointer.touch = false;
      }
    };
    const onClick = (event: MouseEvent) => {
      const p = local(event);
      const hit = hitTestMemorialWall(targets, p.x, p.y);
      const name = hit >= 0 ? targetNames[hit] : undefined;
      if (name && name !== pinnedRef.current) pin(name);
      else release();
    };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    canvas.addEventListener('pointerleave', onPointerEnd);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('memorial-redraw', redrawStill);

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('pointerleave', onPointerEnd);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('memorial-redraw', redrawStill);
    };
  }, [held, names, seedKey, pin, release]);

  // A still wall redraws when the pressed name changes, so it lights on the wall too.
  useEffect(() => {
    if (!held) return;
    const canvas = canvasRef.current;
    canvas?.dispatchEvent(new Event('memorial-redraw'));
  }, [held, presence.pinned]);

  return (
    <div className="ds-memorial-stage" data-held={held ? 'true' : undefined}>
      <div className="ds-memorial-wall" ref={wallRef} data-held={held ? 'true' : undefined}>
        <canvas className="ds-memorial-wall__canvas" ref={canvasRef} aria-hidden="true" />
        <div className="ds-memorial-wall__presence" ref={presenceRef} aria-hidden="true">
          <div
            className="ds-memorial-wall__presence-inner"
            data-visible={presence.visible && presenceName ? 'true' : undefined}
            data-pinned={presence.pinned ? 'true' : undefined}
            style={
              { '--memorial-presence-font': presenceFontFor(presenceName) } as React.CSSProperties
            }
          >
            <p className="ds-memorial-wall__presence-name">{presenceName}</p>
            {meta ? <p className="ds-memorial-wall__presence-meta">{meta}</p> : null}
            {presenceRecord ? (
              <a
                className="ds-memorial-wall__presence-link"
                href={`/entity/${presenceRecord}`}
                tabIndex={-1}
              >
                Read the record
              </a>
            ) : null}
          </div>
        </div>
      </div>
      {messageLines && messageLines.length > 0 ? (
        <div className="ds-memorial-wall__inscription" ref={inscriptionRef}>
          <div className="ds-wrap ds-wrap--record">
            <p
              className="ds-memorial-wall__inscription-text"
              data-begun={linesShown > 0 ? 'true' : undefined}
            >
              {messageLines.map((line, index) => (
                <span
                  key={line.slice(0, 24)}
                  className="ds-memorial-wall__inscription-line"
                  data-shown={index < linesShown ? 'true' : undefined}
                >
                  {line}
                  {index < messageLines.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Mounts the wall still whenever the OS asks for reduced motion. There is no on-page control: the
 * reader's only switch is the system preference, read live.
 */
export function MemorialWallSection(
  props: Omit<MemorialWallAtmosphereProps, 'held'>,
): React.ReactElement {
  const reducedMotion = useReducedMotion();
  return <MemorialWallAtmosphere {...props} held={reducedMotion} />;
}
