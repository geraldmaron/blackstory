/**
 * Full-canvas memorial wall atmosphere: handwritten names packed without overlap,
 * fading in and out. Decorative only (aria-hidden). Readable roll lives in page content.
 */
'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  MEMORIAL_HANDWRITING_FONT_VARS,
  MEMORIAL_NAMES,
} from './memorial-names';
import { packMemorialNames, type PlacedMemorialName } from './pack-memorial-names';
import './memorial-wall.css';

void React;

const CYCLE_SECONDS = 20;

export type MemorialWallAtmosphereProps = {
  readonly seedKey?: string;
  readonly names?: readonly string[];
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

export function MemorialWallAtmosphere({
  seedKey = 'memorial-edition-v6',
  names = MEMORIAL_NAMES,
}: MemorialWallAtmosphereProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [placements, setPlacements] = useState<readonly PlacedMemorialName[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measurer = measureRef.current;
    if (!root || !measurer) {
      return;
    }

    const rebuild = () => {
      const width = Math.max(root.clientWidth, window.innerWidth);
      const height = Math.max(
        root.clientHeight,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      root.style.height = `${height}px`;

      const next = packMemorialNames({
        names,
        fonts: MEMORIAL_HANDWRITING_FONT_VARS,
        canvasWidth: width,
        canvasHeight: height,
        seed: hashSeed(seedKey, width, height),
        cycleSeconds: CYCLE_SECONDS,
        measure: (name, fontFamily, fontSizePx) => {
          measurer.style.fontFamily = fontFamily;
          measurer.style.fontSize = `${fontSizePx}px`;
          measurer.textContent = name;
          const rect = measurer.getBoundingClientRect();
          return { width: rect.width, height: Math.max(rect.height, fontSizePx * 1.1) };
        },
      });
      setPlacements(next);
    };

    let timer: number | null = null;
    const schedule = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(rebuild, 100);
    };

    const run = () => {
      if (document.fonts?.ready) {
        void document.fonts.ready.then(rebuild);
      } else {
        rebuild();
      }
    };

    run();
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [names, seedKey]);

  // Keep wall height in sync after content layout settles.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const height = Math.max(
      document.documentElement.scrollHeight,
      window.innerHeight,
    );
    root.style.height = `${height}px`;
  }, [placements]);

  return (
    <div className="ds-memorial-wall" ref={rootRef} aria-hidden="true">
      <span className="ds-memorial-wall__measurer" ref={measureRef} />
      {placements.map((item) => (
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
          {item.name}
        </span>
      ))}
    </div>
  );
}
