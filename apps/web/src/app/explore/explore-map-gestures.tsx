'use client';

/**
 * Pan, wheel, pinch, and pin-select for the Explore locator underlay. Geography is
 * server-rendered in `ExploreMapUnderlay` so state hairlines exist in the first HTML.
 * A tap that does not pan opens the record sheet; drag still moves the map.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  defaultLocatorView,
  locatorCanvasTransform,
  panLocatorView,
  wheelFactorForDelta,
  zoomLocatorViewAt,
} from '../../components/patterns/record-locator-view';
import {
  emitExplorePinSelect,
  pointerExceededClickSlop,
  readExplorePinTarget,
  type ExplorePinSelectTarget,
} from '../../lib/map-experience/explore-pin-select';

void React;

type PointerPoint = { readonly x: number; readonly y: number };

type DragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  didPan: boolean;
  pin: ExplorePinSelectTarget | null;
};

function pointerDistance(a: PointerPoint, b: PointerPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function ExploreMapGestures() {
  const slotRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef(defaultLocatorView());
  const dragRef = useRef<DragState | null>(null);
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
    const pin = readExplorePinTarget(target);
    // Pin discs are the select target; other links/buttons keep native clicks.
    if (!pin && target?.closest('a, button')) return;
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

    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      didPan: false,
      pin,
    };
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
      if (
        !drag.didPan &&
        !pointerExceededClickSlop(drag.startX, drag.startY, event.clientX, event.clientY)
      ) {
        return;
      }
      if (!drag.didPan) {
        drag.didPan = true;
        root.classList.add('is-dragging');
      }
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
      if (!drag.didPan && drag.pin) {
        event.preventDefault();
        emitExplorePinSelect(drag.pin);
      }
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
