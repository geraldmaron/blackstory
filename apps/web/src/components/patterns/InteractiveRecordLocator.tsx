'use client';

/**
 * Pan/zoom record locator for place-page stands. National SVG inset only — not MapLibre — so
 * city-precision copy stays honest while the reader can still drag and zoom the field.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { locatorPinPercent } from '../../lib/map-experience/albers-usa';
import { savePinContinuity } from '../../lib/discovery/pin-continuity';
import {
  defaultLocatorView,
  locatorCanvasTransform,
  neighborhoodLocatorView,
  panLocatorView,
  cooperativeHint,
  cooperativeWheelVerdict,
  twoFingerFrame,
  wheelFactorForDelta,
  zoomLocatorViewAt,
  type LocatorViewState,
} from './record-locator-view';

const DEFAULT_LOCATOR_SIZE = { width: 720, height: 420 };

void React;

export type InteractiveRecordLocatorProps = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly accessibleName?: string;
  /** Catalog entity id for pin continuity when handing off to the live map. */
  readonly entityId?: string;
  /** Hand off to the live map instrument for street-level exploration. */
  readonly atlasHref?: string;
  /**
   * Open already zoomed onto the pin (place hero). National overview stays the default for
   * smaller stand slots.
   */
  readonly neighborhood?: boolean;
  readonly className?: string;
};

function locatorAriaLabel(
  label: string,
  accessibleName: string | undefined,
  neighborhood: boolean,
): string {
  const place = accessibleName?.trim() || label.trim();
  const base =
    place.length > 0
      ? neighborhood
        ? `Neighborhood locator with ${place} marked.`
        : `Locator map of the United States with ${place} marked.`
      : neighborhood
        ? 'Neighborhood locator map.'
        : 'Locator map of the United States.';
  return `${base} Drag with a mouse or two fingers to pan. Pinch or Control-scroll to zoom. Plus and minus keys zoom. Escape resets the view.`;
}

export function InteractiveRecordLocator({
  lat,
  lng,
  label,
  accessibleName,
  entityId,
  atlasHref,
  neighborhood = false,
  className,
}: InteractiveRecordLocatorProps) {
  const pin = useMemo(() => locatorPinPercent(lng, lat), [lng, lat]);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const [size, setSize] = useState(DEFAULT_LOCATOR_SIZE);
  const initialView = useMemo((): LocatorViewState => {
    if (!neighborhood || !pin) return defaultLocatorView();
    return neighborhoodLocatorView(pin.x, pin.y, size.width, size.height);
  }, [neighborhood, pin, size]);
  const [view, setView] = useState<LocatorViewState>(initialView);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width < 1 || box.height < 1) return;
      setSize((current) => {
        if (Math.abs(current.width - box.width) < 1 && Math.abs(current.height - box.height) < 1) {
          return current;
        }
        return { width: box.width, height: box.height };
      });
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const resetView = useCallback(() => {
    setView(initialView);
  }, [initialView]);

  const zoomAtCenter = useCallback((factor: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    setView((current) => zoomLocatorViewAt(current, factor, rect.width / 2, rect.height / 2));
  }, []);

  /** The cooperative-gesture hint ("Use two fingers…"), shown briefly when the reader uses the
   * page's own gesture over the map. */
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHint = useCallback((kind: 'touch' | 'wheel') => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    setHint(cooperativeHint(kind, isMac));
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 1600);
  }, []);
  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const onWheel = useCallback(
    (event: WheelEvent) => {
      const root = rootRef.current;
      if (!root) return;
      // Embedded in a scrolling page: a plain wheel is the page's. Zoom only on Ctrl/⌘ + wheel,
      // which is also how a trackpad pinch arrives.
      if (cooperativeWheelVerdict(event) === 'page') {
        showHint('wheel');
        return;
      }
      event.preventDefault();
      const rect = root.getBoundingClientRect();
      const anchorX = event.clientX - rect.left;
      const anchorY = event.clientY - rect.top;
      const factor = wheelFactorForDelta(event.deltaY);
      setView((current) => zoomLocatorViewAt(current, factor, anchorX, anchorY));
    },
    [showHint],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  /**
   * Touch, cooperatively: one finger scrolls the page (and earns the hint), two fingers pan by
   * their centroid and pinch-zoom by their spread. Native, non-passive listeners because only a
   * non-passive `touchmove` can stop the page scrolling under a two-finger gesture.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let last: ReturnType<typeof twoFingerFrame> | null = null;
    let singleStart: { x: number; y: number } | null = null;
    const point = (touch: Touch) => {
      const rect = root.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        last = twoFingerFrame(point(event.touches[0]!), point(event.touches[1]!));
        singleStart = null;
        setDragging(true);
      } else if (event.touches.length === 1) {
        singleStart = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length >= 2 && last) {
        event.preventDefault();
        const next = twoFingerFrame(point(event.touches[0]!), point(event.touches[1]!));
        const prev = last;
        last = next;
        setView((current) => {
          const panned = panLocatorView(current, next.cx - prev.cx, next.cy - prev.cy);
          return prev.spread > 0
            ? zoomLocatorViewAt(panned, next.spread / prev.spread, next.cx, next.cy)
            : panned;
        });
        return;
      }
      if (event.touches.length === 1 && singleStart) {
        const touch = event.touches[0]!;
        if (Math.hypot(touch.clientX - singleStart.x, touch.clientY - singleStart.y) > 12) {
          showHint('touch');
          singleStart = null;
        }
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        last = null;
        setDragging(false);
      }
    };
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd);
    root.addEventListener('touchcancel', onTouchEnd);
    return () => {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [showHint]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Touch is handled cooperatively above; a captured one-finger drag here would trap the
    // page's scroll under the map.
    if (event.pointerType === 'touch') return;
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
      aria-label={locatorAriaLabel(label, accessibleName, neighborhood)}
      tabIndex={0}
      style={{ ['--locator-scale' as string]: String(view.scale) }}
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
            aria-label={`See ${label} on the map`}
            style={pinStyle}
            onClick={() => {
              savePinContinuity({
                entityId: entityId ?? label,
                lng,
                lat,
                zoom: 11,
                ...(accessibleName ? { label: accessibleName } : { label }),
              });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                savePinContinuity({
                  entityId: entityId ?? label,
                  lng,
                  lat,
                  zoom: 11,
                  ...(accessibleName ? { label: accessibleName } : { label }),
                });
              }
            }}
          />
        ) : (
          <span className="ds-locator__pin" style={pinStyle} />
        )}
      </div>
      <p className="ds-locator__hint" data-visible={hint ? 'true' : 'false'} aria-hidden="true">
        {hint}
      </p>
      <div className="ds-locator__chrome">
        {/* One map handoff only: the pin carries the atlas link when present. A second
            "See in Explore" chrome link was the surplus affordance the audit named. */}
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
