'use client';

/**
 * Pan/zoom record locator for place-page stands. National SVG inset only — not MapLibre — so
 * city-precision copy stays honest while the reader can still drag and zoom the field.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { locatorPinPercent } from '../../lib/map-experience/albers-usa';
import {
  defaultLocatorView,
  locatorCanvasTransform,
  panLocatorView,
  wheelFactorForDelta,
  zoomLocatorViewAt,
  type LocatorViewState,
} from './record-locator-view';

void React;

export type InteractiveRecordLocatorProps = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly accessibleName?: string;
  /** Hand off to the Live Atlas instrument for street-level exploration. */
  readonly atlasHref?: string;
  readonly className?: string;
};

function locatorAriaLabel(label: string, accessibleName: string | undefined): string {
  const place = accessibleName?.trim() || label.trim();
  const base =
    place.length > 0
      ? `Locator map of the United States with ${place} marked.`
      : 'Locator map of the United States.';
  return `${base} Drag to pan. Scroll or pinch to zoom. Plus and minus keys zoom. Escape resets the view.`;
}

export function InteractiveRecordLocator({
  lat,
  lng,
  label,
  accessibleName,
  atlasHref,
  className,
}: InteractiveRecordLocatorProps) {
  const pin = useMemo(() => locatorPinPercent(lng, lat), [lng, lat]);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const [view, setView] = useState<LocatorViewState>(defaultLocatorView);
  const [dragging, setDragging] = useState(false);

  const resetView = useCallback(() => {
    setView(defaultLocatorView());
  }, []);

  const zoomAtCenter = useCallback((factor: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    setView((current) => zoomLocatorViewAt(current, factor, rect.width / 2, rect.height / 2));
  }, []);

  const onWheel = useCallback((event: WheelEvent) => {
    const root = rootRef.current;
    if (!root) return;
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const factor = wheelFactorForDelta(event.deltaY);
    setView((current) => zoomLocatorViewAt(current, factor, anchorX, anchorY));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('a, button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (deltaX === 0 && deltaY === 0) return;
    setView((current) => panLocatorView(current, deltaX, deltaY));
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resetView();
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomAtCenter(1.2);
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomAtCenter(1 / 1.2);
        return;
      }
      const step = event.shiftKey ? 48 : 24;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setView((current) => panLocatorView(current, step, 0));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setView((current) => panLocatorView(current, -step, 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setView((current) => panLocatorView(current, 0, step));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setView((current) => panLocatorView(current, 0, -step));
      }
    },
    [resetView, zoomAtCenter],
  );

  if (!pin) return null;

  const rootClass = [
    'ds-locator',
    'ds-locator--interactive',
    dragging ? 'is-dragging' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const pinStyle = {
    left: `${pin.x.toFixed(4)}%`,
    top: `${pin.y.toFixed(4)}%`,
  } as const;

  return (
    <div
      ref={rootRef}
      className={rootClass}
      role="application"
      aria-label={locatorAriaLabel(label, accessibleName)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={resetView}
    >
      <div
        className="ds-locator__canvas"
        style={{ transform: locatorCanvasTransform(view) }}
        aria-hidden="true"
      >
        <span className="ds-locator__ground" />
        {atlasHref ? (
          <a
            className="ds-locator__pin ds-locator__pin--link"
            href={atlasHref}
            aria-label={`Open ${label} in Explore`}
            style={pinStyle}
          />
        ) : (
          <span className="ds-locator__pin" style={pinStyle} />
        )}
      </div>
      <div className="ds-locator__chrome">
        {atlasHref ? (
          <a className="ds-locator__atlas" href={atlasHref}>
            See in Explore
          </a>
        ) : null}
        <button type="button" className="ds-locator__reset" onClick={resetView}>
          Reset view
        </button>
        <button
          type="button"
          className="ds-locator__zoom"
          aria-label="Zoom in"
          onClick={() => zoomAtCenter(1.2)}
        >
          +
        </button>
        <button
          type="button"
          className="ds-locator__zoom"
          aria-label="Zoom out"
          onClick={() => zoomAtCenter(1 / 1.2)}
        >
          -
        </button>
      </div>
    </div>
  );
}
