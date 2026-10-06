'use client';

/**
 * Taps on the Explore first-paint picture. The picture is server HTML drawn at the exact frame
 * the live map opens on, so the handoff is a crossfade. It is deliberately NOT a second map: it
 * used to pan, pinch and wheel-zoom on hand-written gestures, then be swapped for the real map
 * mid-gesture — a drag that started on the picture ended on a different camera. Now the only
 * thing it answers is a tap on a pin, which opens that record the same way the live map would,
 * so a reader on a slow connection is never waiting on nothing.
 */
import React, { useEffect, useRef } from 'react';
import {
  emitExplorePinSelect,
  readExplorePinTarget,
} from '../../lib/map-experience/explore-pin-select';

void React;

export function ExploreMapGestures() {
  const slotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = slotRef.current?.parentElement;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const pin = readExplorePinTarget(event.target);
      if (!pin) return;
      event.preventDefault();
      emitExplorePinSelect(pin);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, []);

  return <span ref={slotRef} className="ds-explore-underlay__gestures" aria-hidden="true" />;
}
