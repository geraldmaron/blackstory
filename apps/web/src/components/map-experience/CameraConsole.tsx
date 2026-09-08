/**
 * Camera console — bottom right, z 20. The map's one control vocabulary.
 *
 * Zoom lives here so the map keeps one control vocabulary. MapLibre's `NavigationControl` comes
 * off the explore map in the same change that mounts this console, not before: a floating +/-
 * stack and a console at once is the defect being fixed, but removing the stack while the console
 * is still unmounted would leave the map with no zoom control at all
 * (design-direction-v9-atlas.md §5.5).
 *
 * The six moves and their key caps come from `command-registry.ts`, so the console, the palette
 * and the shortcut sheet cannot disagree about what `O` does.
 *
 * Moves the dignity gate refuses for the selected record render disabled with the reason on hover.
 * Disabled rather than hidden on purpose: a button that vanishes teaches the reader nothing, and
 * the refusal is a statement the archive is willing to make out loud.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '@repo/ui';
import {
  COMMANDS,
  KEYED_CAMERA_MOVES,
  type Command,
} from '../patterns/command-palette/command-registry';
import { allowedMovesFor, type RecordLike } from '../../lib/map-experience/camera-dignity';
import type { CameraMove } from '../../lib/map-experience/camera-moves';
import './camera-console.css';

void React;

/** How long the active move stays washed in copper. §5.5. */
const ACTIVE_WASH_MS = 2200;

/** Air between the console's top edge and the results rail's floor. `--ds-space-3`. */
const CONSOLE_GAP_PX = 12;

/** The rail's own floor when no console sits under it. `--ds-space-4`, the bottom gutter. */
const BARE_GUTTER_PX = 16;

/**
 * The results rail's floor, given the console's footprint — its top edge's distance from the
 * bottom of the viewport, which is the console's own height plus whatever offset it sits at.
 *
 * Footprint rather than height because the offset is not one number: the console sits at
 * `var(--ds-space-4)` on a wide viewport and clears the dock at `calc(var(--ds-space-2) + 66px)`
 * below 820px. Reading the rendered position covers both without this file knowing either.
 */
export function cameraConsoleClearance(footprintPx: number): string {
  return `${Math.round(footprintPx) + CONSOLE_GAP_PX}px`;
}

/**
 * Writes the console's measured clearance to the document root, so the results rail's floor
 * tracks the console instead of a constant kept by hand.
 *
 * The constant kept drifting because the console's height is not a constant: the WCAG 2.5.5
 * touch-target bump grew it by 44px and the token was not updated with it, and the dignity gate's
 * refusal note adds another 68px whenever the selected record is violence-adjacent. Measuring is
 * the same move `syncCommandBarClearance` makes for `--ds-island-clearance`.
 *
 * Passing `null` — the console unmounting, on chrome-hidden or Story mode or a dock toggle —
 * drops the floor back to the plain bottom gutter, so the rail is not reserving room under
 * itself for an instrument that is no longer on the plate.
 */
export function syncCameraConsoleClearance(element: HTMLElement | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!element) {
    root.style.setProperty('--ds-atlas-bottom-right', `${BARE_GUTTER_PX}px`);
    return;
  }
  // `100dvh` is what the rail subtracts from, so pair the measurement with `innerHeight`.
  const footprint = window.innerHeight - element.getBoundingClientRect().top;
  if (!Number.isFinite(footprint) || footprint <= 0) return;
  root.style.setProperty('--ds-atlas-bottom-right', cameraConsoleClearance(footprint));
}

const MOVE_LABELS: Readonly<Record<(typeof KEYED_CAMERA_MOVES)[number], string>> = {
  wide: 'Wide',
  push: 'Push in',
  orbit: 'Orbit',
  tilt: 'Tilt',
  spotlight: 'Spotlight',
  trace: 'Trace',
};

/** Why a move is unavailable. Plain language, no bead ids, no design-doc references. */
const REFUSAL_NOTE =
  'Not available for this record. The archive does not use camera drama on records of harm.';

export type CameraConsoleProps = {
  readonly onMove: (move: CameraMove) => void;
  readonly onZoom: (delta: 1 | -1) => void;
  /** Live camera bearing in degrees, for the compass needle. */
  readonly bearing: number;
  /** Straightens the plate to north. Never gated — see `Compass` below. */
  readonly onResetBearing: () => void;
  /** The record the camera is acting on, if any. Drives the dignity gate. */
  readonly activeRecord?: RecordLike | null;
  readonly spotlit?: boolean;
  readonly className?: string;
};

/** Nearest compass point for the bearing readout — "N", "NE", "E", … — so the header carries a
 * word, not just a rotating needle, for a reader who cannot read the needle's angle at a glance. */
const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

function compassPointFor(bearing: number): (typeof COMPASS_POINTS)[number] {
  const normalized = ((bearing % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index] ?? 'N';
}

/**
 * The compass: a 44px dial matching the zoom stepper's own footprint (WCAG 2.5.5), needle
 * rotated opposite bearing so it always points true north. Click straightens the plate —
 * `resetBearing` holds center/zoom/pitch, so this never reframes, only unrotates.
 */
function Compass({ bearing, onReset }: { readonly bearing: number; readonly onReset: () => void }) {
  const rounded = Math.round(((bearing % 360) + 360) % 360);
  return (
    <button
      type="button"
      className="ds-camera__compass"
      onClick={onReset}
      title={`Bearing ${rounded}° · click to reset to north`}
      aria-label={`Reset map to north (currently facing ${compassPointFor(bearing)}, ${rounded} degrees)`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        style={{ transform: `rotate(${-bearing}deg)` }}
      >
        <path d="M8 1.4 11 8.6 8 7.1 5 8.6z" fill="currentColor" />
        <path d="M8 14.6 5 8.6 8 10.1 11 8.6z" fill="currentColor" opacity="0.4" />
      </svg>
    </button>
  );
}

function commandFor(move: string): Command | undefined {
  return COMMANDS.find((command) => command.id === `camera.${move}`);
}

function MoveIcon({ move }: { readonly move: (typeof KEYED_CAMERA_MOVES)[number] }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': true,
  } as const;

  switch (move) {
    case 'wide':
      return (
        <svg {...common}>
          <path
            d="M6 2.2H2.2V6M10 2.2h3.8V6M6 13.8H2.2V10M10 13.8h3.8V10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'push':
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M5.2 7h3.6M7 5.2v3.6M10.4 10.4l3 3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'orbit':
      return (
        <svg {...common}>
          <ellipse cx="8" cy="8" rx="6.2" ry="3.1" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="8" r="1.7" fill="currentColor" />
        </svg>
      );
    case 'tilt':
      return (
        <svg {...common}>
          <path
            d="M2 11.4 8 4l6 7.4z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M2 13.4h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'spotlight':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 1.6v1.6M8 12.8v1.6M1.6 8h1.6M12.8 8h1.6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'trace':
    default:
      return (
        <svg {...common}>
          <path
            d="M2.4 11.6c3-6.4 8.2-8 11.2-8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="1.6 2.2"
          />
          <circle cx="2.6" cy="11.8" r="1.5" fill="currentColor" />
          <circle cx="13.4" cy="3.8" r="1.5" fill="currentColor" />
        </svg>
      );
  }
}

export function CameraConsole({
  onMove,
  onZoom,
  bearing,
  onResetBearing,
  activeRecord,
  spotlit = false,
  className,
}: CameraConsoleProps) {
  const [recent, setRecent] = useState<CameraMove | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consoleRef = useRef<HTMLElement>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // The results rail sits directly above this console in the right column and sizes itself from
  // `--ds-atlas-bottom-right`. Observe rather than re-run on prop change: the refusal note is the
  // biggest height change, but the panel also reflows when a move label wraps at a narrow width.
  useEffect(() => {
    const element = consoleRef.current;
    if (!element) return;
    syncCameraConsoleClearance(element);
    if (typeof ResizeObserver === 'undefined') return () => syncCameraConsoleClearance(null);
    const observer = new ResizeObserver(() => syncCameraConsoleClearance(element));
    observer.observe(element);
    return () => {
      observer.disconnect();
      syncCameraConsoleClearance(null);
    };
  }, []);

  const run = useCallback(
    (move: CameraMove) => {
      onMove(move);
      setRecent(move);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setRecent(null), ACTIVE_WASH_MS);
    },
    [onMove],
  );

  // With no record selected the camera is acting on geography, and a wide shot is not about
  // anyone. An empty record is the ungated case, which `allowedMovesFor` already models.
  const allowed = allowedMovesFor(activeRecord ?? {});
  const anyRefused = KEYED_CAMERA_MOVES.some((move) => !allowed.has(move));

  return (
    <section ref={consoleRef} className={cx('ds-camera', className)} aria-label="Camera">
      <header className="ds-camera__head">
        <span className="ds-camera__kicker">Camera</span>
        <Compass bearing={bearing} onReset={onResetBearing} />
        <button
          type="button"
          className="ds-camera__zoom"
          onClick={() => onZoom(-1)}
          aria-label="Zoom out"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className="ds-camera__zoom"
          onClick={() => onZoom(1)}
          aria-label="Zoom in"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 8h8M8 4v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="ds-camera__grid">
        {KEYED_CAMERA_MOVES.map((move) => {
          const command = commandFor(move);
          const refused = !allowed.has(move);
          const pressed = move === 'spotlight' ? spotlit : undefined;

          return (
            <button
              key={move}
              type="button"
              className={cx('ds-camera__move', recent === move && 'ds-camera__move--recent')}
              disabled={refused}
              {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
              title={refused ? REFUSAL_NOTE : command?.title}
              onClick={() => run(move)}
            >
              <MoveIcon move={move} />
              <span className="ds-camera__move-label">{MOVE_LABELS[move]}</span>
              {command ? (
                <kbd className="ds-kbd ds-camera__key">{command.keys.join('')}</kbd>
              ) : null}
              {refused ? <span className="ds-visually-hidden">{REFUSAL_NOTE}</span> : null}
            </button>
          );
        })}
      </div>

      {/* The reason lives on every refused button already (`title`, and a visually-hidden span
          for assistive tech); this is the same statement made visible without a hover. */}
      {anyRefused ? <p className="ds-camera__refusal">{REFUSAL_NOTE}</p> : null}
    </section>
  );
}
