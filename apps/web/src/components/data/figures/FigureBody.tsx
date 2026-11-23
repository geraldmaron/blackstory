/**
 * One figure on a page: the finding as its heading, the view switch, the drawing inside the
 * exhibit frame, and the receipt (sources, limits, Cite). docs/ui/DESIGN.md sections 7.3, 9.5.
 *
 * The switch is three links, so it works with JavaScript off, and each figure keeps its own view
 * (`figure-spec.ts`). Print is always Plain or Numbers: when Portrait is on screen the Plain
 * drawing is in the page for the printer. This component reads no data, so the Lives appendix can
 * render it from rows it already holds.
 */
import React, { type ComponentProps } from 'react';
import Link from 'next/link';
import { ExhibitFrame, Receipt, Segmented, buttonClassName } from '@repo/ui';
import { RecordCite } from '../../patterns/RecordCite';
import { dedupeSources, humanSourceLabel } from '../SourceFootnote';
import { figureCsv, type FigureView, type LoadedFigure } from './figure-spec';
import '../data-charts.css';
import './figure.css';

void React;

const VIEW_LABEL: Record<FigureView, string> = {
  portrait: 'Portrait',
  plain: 'Plain',
  numbers: 'Numbers',
};

/** Switching the view keeps the reader where they are. */
function ViewLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} scroll={false} prefetch={false} />;
}

export type FigureBodyProps = {
  /** The figure's address on the page: `#${id}`. */
  readonly id: string;
  readonly data: LoadedFigure;
  /** The view asked for. A figure with no Portrait opens Plain instead. */
  readonly view: FigureView;
  /** Where each view of this figure lives, with every other figure's view kept. */
  readonly hrefs: Readonly<Record<FigureView, string>>;
  /** The address a citation gives, absolute. */
  readonly citeUrl: string;
  /** ISO date of the render, for the citation's access date. */
  readonly accessed: string;
  /** The figure's own page from `/data`, or its place on `/data` from its own page. */
  readonly elsewhere?: { readonly href: string; readonly label: string };
  readonly headingLevel?: 1 | 2 | 3 | 4;
};

export function FigureBody({
  id,
  data,
  view: requested,
  hrefs,
  citeUrl,
  accessed,
  elsewhere,
  headingLevel = 3,
}: FigureBodyProps) {
  const views = (['portrait', 'plain', 'numbers'] as const).filter(
    (option) => option !== 'portrait' || data.portrait != null,
  );
  const view = views.includes(requested) ? requested : 'plain';
  const Heading = `h${headingLevel}` as const;
  const sources = dedupeSources(data.sources);
  // A long source list would push the limits off the screen, so there the limits come first.
  const manySources = sources.length > 4;
  const limits = (
    <p className="ds-figure__limits">
      <strong>Limits.</strong> {data.limits}
    </p>
  );

  return (
    <section className="ds-figure" data-view={view} aria-labelledby={`${id}-finding`}>
      <header className="ds-figure__head">
        <Heading id={`${id}-finding`} className="ds-figure__title">
          {data.headline}
        </Heading>
        <p className="ds-figure__subtitle">{data.title}</p>
      </header>
      <Segmented
        className="ds-figure__switch"
        label={`View of figure ${id}`}
        value={view}
        linkAs={ViewLink}
        options={views.map((option) => ({
          value: option,
          label: VIEW_LABEL[option],
          href: hrefs[option],
        }))}
      />
      <ExhibitFrame
        id={id}
        kind="figure"
        number={id}
        basis={data.basis}
        receipt={
          <div className="ds-figure__receipt">
            {manySources ? limits : null}
            {sources.map((source, index) => (
              <Receipt
                key={source.url}
                source={humanSourceLabel(source.label)}
                href={source.url}
                action={
                  index === 0 ? (
                    <RecordCite
                      title={`${data.title} (figure ${id})`}
                      url={citeUrl}
                      {...(data.revised === undefined ? {} : { published: data.revised })}
                      accessed={accessed}
                    />
                  ) : undefined
                }
              />
            ))}
            {manySources ? null : limits}
            {view === 'portrait' ? (
              <p className="ds-figure__limits ds-figure__screen">
                The Portrait follows the forms of W.E.B. Du Bois’s data portraits for the 1900 Paris
                Exposition. It is drawn from the same rows as Plain and Numbers.
              </p>
            ) : null}
            {data.chapterHref || elsewhere ? (
              <p className="ds-figure__limits ds-figure__screen">
                {data.chapterHref ? <Link href={data.chapterHref}>Read the chapter</Link> : null}
                {data.chapterHref && elsewhere ? <span aria-hidden="true"> · </span> : null}
                {elsewhere ? <Link href={elsewhere.href}>{elsewhere.label}</Link> : null}
              </p>
            ) : null}
          </div>
        }
      >
        <div className="ds-figure__object">
          {view === 'portrait' ? (
            <>
              <div className="ds-figure__screen">{data.portrait}</div>
              <div className="ds-figure__print">{data.plain}</div>
            </>
          ) : view === 'plain' ? (
            data.plain
          ) : (
            <>
              <div
                className="ds-figure__numbers"
                role="region"
                aria-label={`Numbers for figure ${id}`}
                tabIndex={0}
              >
                <table className="ds-data-chart__table">
                  <caption>{data.title}</caption>
                  <thead>
                    <tr>
                      {data.table.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.table.rows.map((row) => (
                      <tr key={row[0]!.text}>
                        {row.map((cell, index) =>
                          index === 0 ? (
                            <th key={index} scope="row">
                              {cell.text}
                            </th>
                          ) : (
                            <td key={index}>{cell.text}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ds-figure__download">
                <a
                  className={buttonClassName('secondary')}
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(figureCsv(data.table))}`}
                  download={`blackstory-${id}.csv`}
                >
                  Download CSV
                </a>
              </p>
            </>
          )}
          {data.definitionChange ? (
            <p className="ds-figure__change">{data.definitionChange}</p>
          ) : null}
        </div>
      </ExhibitFrame>
    </section>
  );
}
