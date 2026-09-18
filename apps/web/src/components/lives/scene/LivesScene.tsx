/**
 * Hand-drawn Lives street: housing, school, work, and era vehicles bound to published cells.
 * Decorative only (aria-hidden); captions live in the text panel. Flat matte, hatch fills.
 */
'use client';

import React, { useMemo } from 'react';
import type {
  LivesDecade,
  LivesDecadeBundle,
  LivesLens,
  LivesUnit,
} from '@repo/domain/statistics/lives';
import {
  sketchHatchLines,
  sketchHousePath,
  sketchRect,
  sketchSchoolPath,
  sketchVehiclePath,
} from '../../patterns/sketch/sketch-path';
import {
  buildLivesSceneLayers,
  livesSceneSeed,
  selectRenderableLivesSceneLayers,
  type LivesSceneLayer,
} from './lives-scene-model';

void React;

export type LivesSceneProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly unit: LivesUnit;
  readonly areaSlug: string;
  readonly affordanceShare?: number;
  readonly affordanceCaption?: string;
};

function LayerGlyph({
  layer,
  x,
  y,
  w,
  h,
  seed,
  decade,
}: {
  readonly layer: LivesSceneLayer;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly seed: number;
  readonly decade: LivesDecade;
}) {
  const empty = layer.density <= 0 && layer.status !== 'costume';
  const strokeClass = empty
    ? 'lives-scene__stroke lives-scene__stroke--empty'
    : layer.emphasized
      ? 'lives-scene__stroke lives-scene__stroke--emphasis'
      : 'lives-scene__stroke';
  let path = '';
  if (layer.id === 'houses' || layer.id === 'affordance') {
    path = sketchHousePath(x, y, w, h, seed);
  } else if (layer.id === 'school') {
    path = sketchSchoolPath(x, y, w, h, seed);
  } else if (layer.id === 'vehicles') {
    path = sketchVehiclePath(x, y, w, h, decade, seed);
  } else if (layer.id === 'work') {
    path = sketchRect(x, y + h * 0.2, w, h * 0.7, seed, 1.5);
  } else {
    path = sketchRect(x, y + h * 0.5, w, h * 0.4, seed, 1.8);
  }
  const hatch = empty
    ? []
    : sketchHatchLines(x, y, w, h, layer.status === 'costume' ? 0.3 : layer.density, seed + 20);
  return (
    <g className={layer.emphasized ? 'lives-scene__layer--emphasis' : undefined}>
      <path className={strokeClass} d={path} fill="none" />
      {hatch.map((line, index) => (
        <line
          key={index}
          className="lives-scene__hatch"
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
        />
      ))}
    </g>
  );
}

export function LivesScene({
  decade,
  emphasis,
  unit,
  areaSlug,
  affordanceShare,
  affordanceCaption,
}: LivesSceneProps) {
  const layers = useMemo(
    () =>
      buildLivesSceneLayers({
        decade,
        emphasis,
        unit,
        ...(typeof affordanceShare === 'number' ? { affordanceShare } : {}),
        ...(affordanceCaption ? { affordanceCaption } : {}),
      }),
    [decade, emphasis, unit, affordanceShare, affordanceCaption],
  );
  const seed = livesSceneSeed(decade.decade, areaSlug, emphasis);
  const visibleLayers = selectRenderableLivesSceneLayers(layers);

  return (
    <figure className="lives-scene">
      <svg
        className="lives-scene__svg"
        viewBox="0 0 640 220"
        role="presentation"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="lives-scene__horizon"
          d={sketchRect(12, 150, 616, 8, seed + 1, 1.2)}
          fill="none"
        />
        {visibleLayers.map((layer, index) => {
          const slot = index % 5;
          const x = 40 + slot * 115;
          const y = layer.id === 'ground' ? 130 : 40 + (index % 2) * 20;
          const w = layer.id === 'ground' ? 560 : 90;
          const h = layer.id === 'ground' ? 40 : 90;
          return (
            <LayerGlyph
              key={layer.id}
              layer={layer}
              x={layer.id === 'ground' ? 40 : x}
              y={y}
              w={w}
              h={h}
              seed={seed + index * 11}
              decade={decade.decade}
            />
          );
        })}
      </svg>
      <figcaption className="lives-scene__captions">
        <p className="lives-scene__kicker">{decade.label} street</p>
        <ul className="lives-scene__caption-list">
          {visibleLayers.map((layer) => (
            <li
              key={layer.id}
              data-status={layer.status}
              data-emphasis={layer.emphasized || undefined}
            >
              <strong>{layer.label}</strong>
              <span>{layer.caption}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
