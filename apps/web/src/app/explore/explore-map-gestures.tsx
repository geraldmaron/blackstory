'use client';

/**
 * Pan, wheel, and pinch for the Explore locator underlay. Geography is server-rendered
 * in `ExploreMapUnderlay` so state hairlines exist in the first HTML.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  defaultLocatorView,
  locatorCanvasTransform,
  panLocatorView,
  wheelFactorForDelta,
  zoomLocatorViewAt,
} from '../../components/patterns/record-locator-view';

void React;

type PointerPoint = { readonly x: number; readonly y: number };

function pointerDistance(a: PointerPoint, b: PointerPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function ExploreMapGestures() {
  const slotRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef(defaultLocatorView());
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const pinchRef = useRef<{ distance: number } | null>(null);

  const applyTransform = useCallback((transform: string) => {
    const canvas = slotRef.current?.parentElement?.querySelector<HTMLElement>(
      '.ds-explore-underlay__canvas',
    );
    if (canvas) canvas.style.transform = transform;
  }, []);

  const onPointerDown = useCallback((event: PointerEvent) => {
    const root = slotRef.current?.parentElement;
    if (!root) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    root.setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()];
      const first = points[0];
      const second = points[1];
      if (first && second) {
        pinchRef.current = { distance: pointerDistance(first, second) };
      }
      dragRef.current = null;
      root.classList.remove('is-dragging');
      return;
    }

    dragRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    root.classList.add('is-dragging');
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const root = slotRef.current?.parentElement;
      if (!root) return;

      if (pinchRef.current && pointersRef.current.size >= 2) {
        const points = [...pointersRef.current.values()];
        const first = points[0];
        const second = points[1];
        if (!first || !second) return;
        const distance = pointerDistance(first, second);
        if (distance < 8 || pinchRef.current.distance < 8) {
          pinchRef.current = { distance };
          return;
        }
        const factor = distance / pinchRef.current.distance;
        pinchRef.current = { distance };
        const rect = root.getBoundingClientRect();
        const mid = pointerMidpoint(first, second);
        const next = zoomLocatorViewAt(
          viewRef.current,
          factor,
          mid.x - rect.left,
          mid.y - rect.top,
        );
        viewRef.current = next;
        applyTransform(locatorCanvasTransform(next));
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      if (deltaX === 0 && deltaY === 0) return;
      const next = panLocatorView(viewRef.current, deltaX, deltaY);
      viewRef.current = next;
      applyTransform(locatorCanvasTransform(next));
    },
    [applyTransform],
  );

  const endPointer = useCallback((event: PointerEvent) => {
    const root = slotRef.current?.parentElement;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      dragRef.current = null;
      root?.classList.remove('is-dragging');
    }
    if (root?.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    const root = slotRef.current?.parentElement;
    if (!root) return;
    applyTransform(locatorCanvasTransform(viewRef.current));

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = root.getBoundingClientRect();
      const next = zoomLocatorViewAt(
        viewRef.current,
        wheelFactorForDelta(event.deltaY),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      viewRef.current = next;
      applyTransform(locatorCanvasTransform(next));
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', endPointer);
    root.addEventListener('pointercancel', endPointer);
    return () => {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', endPointer);
      root.removeEventListener('pointercancel', endPointer);
    };
  }, [applyTransform, endPointer, onPointerDown, onPointerMove]);

  return <span ref={slotRef} className="ds-explore-underlay__gestures" aria-hidden="true" />;
}
