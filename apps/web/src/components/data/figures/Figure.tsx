/**
 * A registry figure by id: loads its rows and renders `FigureBody`. An async server component, so
 * a page, a story or a record can place `<Figure id="D-01" />` and nothing else.
 */
import React from 'react';
import { absolutePublicUrl } from '../../../lib/seo/metadata-builders';
import { FigureBody, type FigureBodyProps } from './FigureBody';
import {
  DEFAULT_FIGURE_VIEW,
  FIGURES,
  FIGURE_VIEWS,
  figurePagePath,
  figureViewOf,
  figureViewsParam,
  type FigureId,
  type FigureView,
  type FigureViews,
} from './registry';

void React;

export async function Figure({
  id,
  views,
  path = '/data',
  solo = false,
  elsewhere,
  headingLevel,
}: {
  readonly id: FigureId;
  /** The page's parsed `view` parameter. */
  readonly views: FigureViews;
  /** The page the figure is on; its address there is `${path}#${id}`. */
  readonly path?: string;
  /** The only figure on its page: its view is the bare `view` value. */
  readonly solo?: boolean;
} & Pick<FigureBodyProps, 'elsewhere' | 'headingLevel'>) {
  const data = await FIGURES[id].load();
  if (!data) return null;
  const href = (view: FigureView) => {
    const param = solo
      ? view === DEFAULT_FIGURE_VIEW
        ? undefined
        : view
      : figureViewsParam(views, id, view);
    return `${path}${param ? `?view=${param}` : ''}#${id}`;
  };
  return (
    <FigureBody
      id={id}
      data={data}
      view={figureViewOf(views, id)}
      hrefs={
        Object.fromEntries(FIGURE_VIEWS.map((view) => [view, href(view)])) as Record<
          FigureView,
          string
        >
      }
      // A citation gives the figure's own page, whichever page it was read on.
      citeUrl={absolutePublicUrl(figurePagePath(id))}
      accessed={new Date().toISOString()}
      {...(elsewhere ? { elsewhere } : {})}
      {...(headingLevel ? { headingLevel } : {})}
    />
  );
}
