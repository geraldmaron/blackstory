/**
 * The three figures of the Lives evidence appendix, on the site's one figure anatomy
 * (`components/data/figures`): the finding as the heading, Plain and Numbers behind a switch of
 * links, the sources, limits and Cite always visible, and a CSV built from the table's own columns.
 *
 *   L-01  the middle class band by group, decade by decade, for one area
 *   L-02  class bands by group, one decade
 *   L-03  measured conditions by group, one decade
 *
 * Each depends on the area, the decade and the emphasized group, so its address is the appendix's
 * own URL with the figure's id as the anchor. None has a Portrait: a class band can be a few
 * percent wide, too small to print its value on, and no form here was worth a second drawing.
 */
import React from 'react';
import {
  LIVES_LENSES,
  LIVES_LENS_LABELS,
  type LivesAreaBundle,
  type LivesCell,
  type LivesConditionUnit,
  type LivesDecadeBundle,
  type LivesLens,
} from '@repo/domain/statistics/lives';
import { describeLivesCell, formatLivesPercent } from '../../lib/lives/lives-format';
import { buildLivesHref, type LivesViewState } from '../../lib/lives/lives-url-state';
import { FigureBody } from '../data/figures/FigureBody';
import {
  FIGURE_VIEWS,
  buildFigure,
  figureViewOf,
  figureViewsParam,
  type FigureColumn,
  type FigureView,
  type FigureViews,
  type LoadedFigure,
} from '../data/figures/figure-spec';
import { LivesClassArcChart } from './LivesClassArcChart';
import {
  LIVES_BUCKET_LABELS,
  LivesClassSharesChart,
  livesBucketsFor,
  livesClassSharesReading,
} from './LivesClassSharesChart';
import { LivesConditionsChart, livesVisibleConditions } from './LivesConditionsChart';
import { drawnValue, sourcesOfCells } from './lives-chart-utils';

void React;

/** Where the appendix is and how it was asked for: what a figure's links and citation need. */
export type LivesFigureFrame = {
  readonly areaSlug: string;
  readonly state: LivesViewState;
  /** The page's `view` URL parameter. */
  readonly views: FigureViews;
  /** The site's origin, for the citation. */
  readonly origin: string;
  /** ISO date of the server render. */
  readonly accessed: string;
};

/** A cell as the table prints it: the value, then its margin, coverage or the reason it is absent. */
function cellText(cell: LivesCell, unit?: LivesConditionUnit): string {
  const display = describeLivesCell(cell, unit);
  return display.detail ? `${display.text} (${display.detail})` : display.text;
}

const cellCsv = (cell: LivesCell, unit?: LivesConditionUnit) =>
  drawnValue(cell) ?? describeLivesCell(cell, unit).text;

function LivesFigure({
  id,
  data,
  frame,
  headingLevel,
}: {
  readonly id: string;
  readonly data: LoadedFigure;
  readonly frame: LivesFigureFrame;
  readonly headingLevel: 2 | 3;
}) {
  const page = buildLivesHref(frame.areaSlug, frame.state);
  const href = (view: FigureView) => {
    const param = figureViewsParam(frame.views, id, view);
    return `${page}${param ? `${page.includes('?') ? '&' : '?'}view=${param}` : ''}#${id}`;
  };
  return (
    <FigureBody
      id={id}
      data={data}
      view={figureViewOf(frame.views, id)}
      hrefs={
        Object.fromEntries(FIGURE_VIEWS.map((view) => [view, href(view)])) as Record<
          FigureView,
          string
        >
      }
      citeUrl={`${frame.origin}${page}#${id}`}
      accessed={frame.accessed}
      headingLevel={headingLevel}
    />
  );
}

/* —— L-01: the middle band, decade by decade ——————————————————————————————————— */

export function LivesClassArcFigure({
  bundle,
  emphasis,
  selectedDecade,
  frame,
}: {
  readonly bundle: LivesAreaBundle;
  readonly emphasis: LivesLens;
  readonly selectedDecade: number;
  readonly frame: LivesFigureFrame;
}) {
  const decades = bundle.decades;
  const middle = (decade: LivesDecadeBundle, lens: LivesLens) => decade.classShares[lens].middle;
  const cells = decades.flatMap((decade) => LIVES_LENSES.map((lens) => middle(decade, lens)));
  if (decades.length < 2 || !cells.some((cell) => drawnValue(cell) !== null)) return null;

  const selected = decades.find((entry) => entry.decade === selectedDecade) ?? decades.at(-1)!;
  const value = drawnValue(middle(selected, emphasis));
  const share = (decade: LivesDecadeBundle, lens: LivesLens) => {
    const drawn = drawnValue(middle(decade, lens));
    return drawn === null ? 'Not published' : formatLivesPercent(drawn);
  };

  const data = buildFigure<LivesDecadeBundle>(
    {
      id: 'L-01',
      name: 'Middle class band by decade',
      title: `Middle-band class share by group · ${bundle.areaName}, ${decades[0]!.label} to ${decades.at(-1)!.label}`,
      basis: `${decades[0]!.label} to ${decades.at(-1)!.label}`,
      limits:
        'Each line is one group’s middle class (or middle work) band as the census published it that decade. Class is measured differently across regimes, so a line breaks at each change of measure and wherever a group was not published. A gap is missing publication, not zero.',
      headline: () =>
        value === null
          ? `${LIVES_LENS_LABELS[emphasis]} middle-band share was not published for the ${selected.label}`
          : `In the ${selected.label}, ${formatLivesPercent(value)} of ${LIVES_LENS_LABELS[emphasis]} ${selected.classLabel.toLowerCase()} sat in the middle band`,
      columns: [
        { label: 'Decade', cell: (decade) => decade.label },
        ...LIVES_LENSES.map((lens): FigureColumn<LivesDecadeBundle> => ({
          label: LIVES_LENS_LABELS[lens],
          cell: (decade) => share(decade, lens),
          csv: (decade) => drawnValue(middle(decade, lens)) ?? 'Not published',
        })),
        // The change of measure, said in the table as the chart's rule says it.
        { label: 'What was measured', cell: (decade) => decade.classLabel },
      ],
      plain: () => (
        <LivesClassArcChart bundle={bundle} emphasis={emphasis} selectedDecade={selected.decade} />
      ),
    },
    { rows: decades, sources: sourcesOfCells(cells) },
  );
  // The appendix's first finding sits straight under the page title.
  return <LivesFigure id="L-01" data={data} frame={frame} headingLevel={2} />;
}

/* —— L-02: class bands by group, one decade ———————————————————————————————————— */

type DecadeFigureProps = {
  readonly decade: LivesDecadeBundle;
  readonly emphasis: LivesLens;
  readonly frame: LivesFigureFrame;
};

export function LivesClassSharesFigure({ decade, emphasis, frame }: DecadeFigureProps) {
  const buckets = livesBucketsFor(decade);
  const cells = LIVES_LENSES.flatMap((lens) =>
    buckets.map((bucket) => decade.classShares[lens][bucket]),
  );
  if (!cells.some((cell) => drawnValue(cell) !== null)) return null;

  const data = buildFigure<LivesLens>(
    {
      id: 'L-02',
      name: 'Class bands by group',
      title: `${decade.classLabel} by group, ${decade.label}`,
      basis: decade.label,
      limits:
        'Each bar is one group. Its parts are the class bands from the table the census published that decade, not a comparison of incomes across measurement regimes.',
      headline: () => livesClassSharesReading(decade, emphasis),
      columns: [
        { label: 'Group', cell: (lens) => LIVES_LENS_LABELS[lens] },
        ...buckets.map((bucket): FigureColumn<LivesLens> => ({
          label: LIVES_BUCKET_LABELS[bucket],
          cell: (lens) => cellText(decade.classShares[lens][bucket]),
          csv: (lens) => cellCsv(decade.classShares[lens][bucket]),
        })),
        {
          label: 'Definition',
          cell: (lens) =>
            buckets
              .map((bucket) => decade.classShares[lens][bucket].definitionLabel)
              .find(Boolean) ?? '',
        },
      ],
      plain: () => <LivesClassSharesChart decade={decade} emphasis={emphasis} />,
    },
    { rows: LIVES_LENSES, sources: sourcesOfCells(cells) },
  );
  return <LivesFigure id="L-02" data={data} frame={frame} headingLevel={3} />;
}

/* —— L-03: measured conditions by group, one decade ———————————————————————————— */

export function LivesConditionsFigure({ decade, emphasis, frame }: DecadeFigureProps) {
  const visible = livesVisibleConditions(decade);
  const first = visible[0];
  if (!first) return null;
  type Condition = (typeof visible)[number];

  const data = buildFigure<Condition>(
    {
      id: 'L-03',
      name: 'Conditions by group',
      title: `Conditions by group, ${decade.label}`,
      basis: decade.label,
      limits:
        'Each panel is one published measure, drawn on that measure’s own scale. A hatched track means no figure was published for that group and measure; it is not a zero.',
      headline: () =>
        `${LIVES_LENS_LABELS[emphasis]} ${first.label.toLowerCase()} in the ${decade.label}: ${describeLivesCell(first.cells[emphasis], first.unit).text}`,
      columns: [
        { label: 'Measure', cell: (condition) => condition.label },
        { label: 'Who is counted', cell: (condition) => condition.universe },
        ...LIVES_LENSES.map((lens): FigureColumn<Condition> => ({
          label: LIVES_LENS_LABELS[lens],
          cell: (condition) => cellText(condition.cells[lens], condition.unit),
          csv: (condition) => cellCsv(condition.cells[lens], condition.unit),
        })),
      ],
      plain: () => <LivesConditionsChart decade={decade} emphasis={emphasis} />,
    },
    {
      rows: visible,
      sources: sourcesOfCells(
        visible.flatMap((condition) => LIVES_LENSES.map((lens) => condition.cells[lens])),
      ),
    },
  );
  return <LivesFigure id="L-03" data={data} frame={frame} headingLevel={3} />;
}
