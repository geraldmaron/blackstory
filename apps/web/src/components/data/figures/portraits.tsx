/**
 * The two Portrait forms, in the lineage of W.E.B. Du Bois's data portraits for the 1900 Paris
 * Exposition: the bar that runs and then coils, and stacked proportional fields. Both are drawn
 * from the data by `geometry.ts`; every value is printed on its mark; a missing value is a gap
 * that says "no data". Flat ink, copper and sand with an ink outline. No aging and no period
 * lettering (docs/ui/DESIGN.md section 9.5).
 *
 * Each form is drawn twice, for a narrow and a wide column, and `figure.css` shows one. A single
 * drawing scaled to a phone would shrink its labels below a readable size.
 */
import React, { type ReactNode } from 'react';
import {
  coiledBar,
  stackedFields,
  type CoilLayout,
  type FieldLayout,
  type Point,
} from './geometry';

void React;

export type PortraitTone = 'ink' | 'copper' | 'sand';

const round = (value: number) => Math.round(value * 100) / 100;

/** Label size in each drawing's own units. The narrow drawing renders near one unit per pixel. */
const LABEL_SIZE = { narrow: 11, wide: 12.5 } as const;

function pathOf(points: readonly Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join('');
}

/* —— coiled bar ———————————————————————————————————————————————————————————— */

export const COIL_LAYOUTS: Readonly<Record<'narrow' | 'wide', CoilLayout>> = {
  narrow: {
    width: 320,
    radius: 144,
    thickness: 24,
    pitch: 28,
    unit: 7,
    gap: 60,
    breakLength: 10,
    margin: 4,
  },
  wide: {
    width: 720,
    radius: 160,
    thickness: 28,
    pitch: 34,
    unit: 8,
    gap: 72,
    breakLength: 12,
    margin: 4,
  },
};

export type CoilPortraitItem = {
  /** The census year, printed on the stretch. */
  readonly key: string;
  readonly value: number | null;
  /** The value as printed: "19.3%". */
  readonly text: string;
  readonly tone: PortraitTone;
  readonly breakBefore?: boolean;
};

export function CoiledBarPortrait({
  id,
  label,
  items,
  children,
}: {
  /** Prefix for the ids the labels' paths need; the figure's own id. */
  readonly id: string;
  readonly label: string;
  readonly items: readonly CoilPortraitItem[];
  /** The key, set beside the bar. */
  readonly children: ReactNode;
}) {
  return (
    <div className="ds-portrait ds-portrait--coil">
      {(['narrow', 'wide'] as const).map((size) => {
        const layout = COIL_LAYOUTS[size];
        const geometry = coiledBar(items, layout);
        return (
          <svg
            key={size}
            className={`ds-portrait__svg ds-portrait__svg--${size}`}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            role="img"
            aria-label={label}
            data-layout={size}
          >
            {geometry.stretches.map((stretch, index) => {
              const item = items[index]!;
              const d = pathOf(stretch.points);
              const textId = `${id}-${size}-${index}`;
              return (
                <g key={stretch.key}>
                  <path
                    className="ds-portrait__edge"
                    d={d}
                    strokeWidth={layout.thickness + 3}
                    {...(stretch.value === null ? { strokeDasharray: '3 3' } : {})}
                  />
                  <path
                    className="ds-portrait__stretch"
                    d={d}
                    strokeWidth={layout.thickness}
                    data-stretch={stretch.key}
                    data-value={stretch.value ?? 'none'}
                    data-tone={stretch.value === null ? 'gap' : item.tone}
                  />
                  <path
                    id={textId}
                    d={pathOf(stretch.reversed ? [...stretch.points].reverse() : stretch.points)}
                    fill="none"
                  />
                  <text
                    className="ds-portrait__label"
                    data-tone={stretch.value === null ? 'gap' : item.tone}
                    dominantBaseline="central"
                    fontSize={LABEL_SIZE[size]}
                  >
                    <textPath href={`#${textId}`} startOffset="50%" textAnchor="middle">
                      {stretch.value === null ? `${item.key} no data` : `${item.key} ${item.text}`}
                    </textPath>
                  </text>
                </g>
              );
            })}
            {geometry.ticks.map(([a, b], index) => (
              <line
                key={index}
                className="ds-portrait__tick"
                x1={round(a.x)}
                y1={round(a.y)}
                x2={round(b.x)}
                y2={round(b.y)}
              />
            ))}
            {geometry.breaks.map(([a, b], index) => (
              <line
                key={index}
                className="ds-portrait__break"
                x1={round(a.x)}
                y1={round(a.y)}
                x2={round(b.x)}
                y2={round(b.y)}
              />
            ))}
          </svg>
        );
      })}
      <div className="ds-portrait__key">{children}</div>
    </div>
  );
}

/* —— stacked proportional fields ————————————————————————————————————————————— */

export const FIELD_LAYOUTS: Readonly<Record<'narrow' | 'wide', FieldLayout>> = {
  narrow: { width: 320, height: 280, gap: 4 },
  wide: { width: 720, height: 320, gap: 10 },
};

/** Room under the columns for the year. */
const FIELD_FOOT = 22;

export type FieldPortraitColumn = {
  readonly key: string;
  readonly parts: readonly {
    readonly id: string;
    readonly value: number | null;
    /** The part's share as printed: "13.5%". */
    readonly text: string;
    readonly tone: PortraitTone;
  }[];
};

export function StackedFieldsPortrait({
  label,
  columns,
  children,
}: {
  readonly label: string;
  readonly columns: readonly FieldPortraitColumn[];
  readonly children: ReactNode;
}) {
  return (
    <div className="ds-portrait ds-portrait--fields">
      <div className="ds-portrait__key">{children}</div>
      {(['narrow', 'wide'] as const).map((size) => {
        const layout = FIELD_LAYOUTS[size];
        const geometry = stackedFields(columns, layout);
        return (
          <svg
            key={size}
            className={`ds-portrait__svg ds-portrait__svg--${size}`}
            viewBox={`-1 -1 ${layout.width + 2} ${layout.height + FIELD_FOOT + 2}`}
            role="img"
            aria-label={label}
            data-layout={size}
          >
            {geometry.columns.map((column, index) => {
              const center = round(column.x + geometry.columnWidth / 2);
              return (
                <g key={column.key}>
                  {column.rects.length === 0 ? (
                    <>
                      <rect
                        className="ds-portrait__field"
                        data-tone="gap"
                        x={round(column.x)}
                        y={0}
                        width={round(geometry.columnWidth)}
                        height={layout.height}
                        strokeDasharray="3 3"
                      />
                      <text
                        className="ds-portrait__label"
                        data-tone="gap"
                        textAnchor="middle"
                        fontSize={LABEL_SIZE[size]}
                      >
                        <tspan x={center} y={layout.height / 2 - 2}>
                          no
                        </tspan>
                        <tspan x={center} dy="1.2em">
                          data
                        </tspan>
                      </text>
                    </>
                  ) : (
                    column.rects.map((rect, part) => {
                      const tone = columns[index]!.parts[part]!.tone;
                      return (
                        <React.Fragment key={rect.id}>
                          <rect
                            className="ds-portrait__field"
                            data-field={`${rect.key}:${rect.id}`}
                            data-value={rect.value}
                            data-tone={tone}
                            x={round(rect.x)}
                            y={round(rect.y)}
                            width={round(rect.width)}
                            height={round(rect.height)}
                          />
                          <text
                            className="ds-portrait__label"
                            data-tone={tone}
                            x={center}
                            y={round(rect.y + rect.height / 2)}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={LABEL_SIZE[size]}
                          >
                            {columns[index]!.parts[part]!.text}
                          </text>
                        </React.Fragment>
                      );
                    })
                  )}
                  <text
                    className="ds-portrait__year"
                    x={center}
                    y={layout.height + FIELD_FOOT - 5}
                    textAnchor="middle"
                    fontSize={LABEL_SIZE[size]}
                  >
                    {column.key}
                  </text>
                </g>
              );
            })}
          </svg>
        );
      })}
    </div>
  );
}
