/**
 * A registry figure embedded outside `/data`: on a record page or in a story (docs/ui/DESIGN.md
 * sections 9.1, 9.3, 9.5). It is `FigureBody` at the width it is given, opened in Plain, with its
 * scope said in words, the build date of its data in the receipt, a switch that changes the view
 * in place, and a link to the figure's own page. A figure that cannot load renders `fallback`.
 */
import React, { type ReactNode } from 'react';
import { absolutePublicUrl } from '../../../lib/seo/metadata-builders';
import { formatRecordDate } from '../../patterns/format-record-date';
import { FigureBody } from './FigureBody';
import { figureAsOf, seriesScope, type FigureScope } from './figure-coverage';
import { DEFAULT_FIGURE_VIEW, FIGURES, figurePagePath, type FigureId } from './registry';

void React;

export async function FigureEmbed({
  id,
  scope,
  focus,
  writtenAsOf,
  quiet = false,
  headingLevel = 3,
  fallback = null,
}: {
  readonly id: FigureId;
  /** What the figure covers for the page it is on. Defaults to the figure's own geography. */
  readonly scope?: FigureScope;
  /** A state name to mark, in a figure that compares states. */
  readonly focus?: string;
  /**
   * The build of the data a story was written against (the figure's `built` at the time, ISO).
   * The receipt says so, and says when the drawing is a later build.
   */
  readonly writtenAsOf?: string;
  readonly quiet?: boolean;
  readonly headingLevel?: 2 | 3 | 4;
  readonly fallback?: ReactNode;
}) {
  const data = await FIGURES[id].load(focus ? { focus } : undefined);
  if (!data) return fallback;
  const page = figurePagePath(id);
  const said = scope ?? (data.coverage ? seriesScope(data.coverage) : undefined);
  const asOf = figureAsOf(data.built, writtenAsOf, formatRecordDate);
  return (
    <FigureBody
      id={id}
      data={data}
      view={DEFAULT_FIGURE_VIEW}
      hrefs={{ portrait: page, plain: page, numbers: page }}
      citeUrl={absolutePublicUrl(page)}
      accessed={new Date().toISOString()}
      elsewhere={{
        href: page,
        label: asOf?.drifted
          ? 'See the current figure on its own page'
          : 'This figure on its own page',
      }}
      headingLevel={headingLevel}
      inPlace
      quiet={quiet}
      {...(said ? { scope: said } : {})}
      {...(asOf ? { asOf: asOf.text } : {})}
    />
  );
}
