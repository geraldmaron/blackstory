'use client';

/**
 * The map's own controls: locate, zoom, and north. Every maps app puts these on the map itself,
 * so that is where readers look for them; before this, locating lived as a small text link inside
 * the Filters panel and zoom only existed inside the hidden camera console.
 *
 * One vertical group, 44px targets (WCAG 2.5.5), the same surface recipe as the dock chips. The
 * compass only appears once the plate is rotated, and pressing it straightens it.
 */
import React from 'react';
import { cx } from '@repo/ui';
import './map-controls.css';

void React;

export type MapControlsProps = {
  readonly onLocate: () => void;
  readonly locating: boolean;
  /** True while the reader's own position is the active "near" constraint. */
  readonly located: boolean;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly bearing: number;
  readonly onResetBearing: () => void;
  readonly className?: string;
  readonly style?: React.CSSProperties;
};

/** The compass shows only when the plate is turned more than this many degrees off north. */
export const COMPASS_THRESHOLD_DEGREES = 1;

export function MapControls({
  onLocate,
  locating,
  located,
  onZoomIn,
  onZoomOut,
  bearing,
  onResetBearing,
  className,
  style,
}: MapControlsProps) {
  const rotated = Math.abs(((bearing % 360) + 360) % 360) > COMPASS_THRESHOLD_DEGREES &&
    Math.abs(((bearing % 360) + 360) % 360) < 360 - COMPASS_THRESHOLD_DEGREES;

  return (
    <div className={cx('ds-map-controls', className)} style={style} role="group" aria-label="Map controls">
      <button
        type="button"
        className="ds-map-controls__btn ds-map-controls__locate"
        onClick={onLocate}
        aria-label={located ? 'Re-center on your location' : 'Show records near your location'}
        aria-pressed={located}
        aria-busy={locating}
        data-state={locating ? 'locating' : located ? 'located' : 'idle'}
        title={located ? 'Re-center on you' : 'Near me'}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle
            cx="10"
            cy="10"
            r="4"
            stroke="currentColor"
            strokeWidth="1.6"
            fill={located ? 'currentColor' : 'none'}
          />
          <path
            d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="ds-map-controls__stack">
        <button
          type="button"
          className="ds-map-controls__btn"
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className="ds-map-controls__btn"
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {rotated ? (
        <button
          type="button"
          className="ds-map-controls__btn ds-map-controls__compass"
          onClick={onResetBearing}
          aria-label="Reset map to north"
          title="Reset to north"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            aria-hidden="true"
            style={{ transform: `rotate(${-bearing}deg)` }}
          >
            <path d="M10 2.5 13 10h-6z" fill="var(--ds-accent-graphic)" />
            <path d="M10 17.5 7 10h6z" fill="currentColor" opacity="0.45" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
