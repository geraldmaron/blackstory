/**
 * One registry figure on a page: the finding as its heading, the view switch, the drawing inside
 * the exhibit frame, and the receipt (sources, limits, Cite). docs/ui/DESIGN.md sections 7.3, 9.5.
 *
 * The view is a URL parameter, so a shared link opens the same view, and the switch is three
 * links, so it works with JavaScript off. Print is always Plain or Numbers: when Portrait is on
 * screen the Plain drawing is in the page for the printer.
 */
import React, { type ComponentProps } from 'react';
import Link from 'next/link';
import { ExhibitFrame, Receipt, Segmented, buttonClassName } from '@repo/ui';
import { absolutePublicUrl } from '../../../lib/seo/metadata-builders';
import { RecordCite } from '../../patterns/RecordCite';
import { dedupeSources, humanSourceLabel } from '../SourceFootnote';
import { FIGURES, figureCsv, type FigureId, type FigureView } from './registry';
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

export async function Figure({
  id,
  view: requested,
  path = '/data',
  headingLevel = 3,
}: {
  readonly id: FigureId;
  readonly view: FigureView;
  /** The page the figure is on; its address is `${path}#${id}`. */
  readonly path?: string;
  readonly headingLevel?: 2 | 3 | 4;
}) {
  const figure = FIGURES[id];
  const data = await figure.load();
  if (!data) return null;

  const views = (['portrait', 'plain', 'numbers'] as const).filter(
    (option) => option !== 'portrait' || data.portrait !== undefined,
  );
  const view = views.includes(requested) ? requested : 'plain';
  const Heading = `h${headingLevel}` as const;
  const table = (
    <table className="ds-data-chart__table">
      <caption>{figure.title}</caption>
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
  );

  return (
    <section className="ds-figure" data-view={view} aria-labelledby={`${id}-finding`}>
      <header className="ds-datafig__head">
        <Heading id={`${id}-finding`} className="ds-datafig__title">
          {data.headline}
        </Heading>
        <p className="ds-datafig__subtitle">{figure.title}</p>
      </header>
      <Segmented
        className="ds-figure__switch"
        label={`View of figure ${id}`}
        value={view}
        linkAs={ViewLink}
        options={views.map((option) => ({
          value: option,
          label: VIEW_LABEL[option],
          href: `${path}${option === 'plain' ? '' : `?view=${option}`}#${id}`,
        }))}
      />
      <ExhibitFrame
        id={id}
        kind="figure"
        number={id}
        basis={figure.basis}
        receipt={
          <div className="ds-figure__receipt">
            {dedupeSources(data.sources).map((source, index) => (
              <Receipt
                key={source.url}
                source={humanSourceLabel(source.label)}
                href={source.url}
                action={
                  index === 0 ? (
                    <RecordCite
                      title={`${figure.title} (figure ${id})`}
                      url={absolutePublicUrl(`${path}#${id}`)}
                      {...(data.revised === undefined ? {} : { published: data.revised })}
                      accessed={new Date().toISOString()}
                    />
                  ) : undefined
                }
              />
            ))}
            <p className="ds-datafig__limits">
              <strong>Limits.</strong> {figure.limits}
            </p>
            {view === 'portrait' ? (
              <p className="ds-datafig__limits ds-figure__screen">
                The Portrait follows the forms of W.E.B. Du Bois’s data portraits for the 1900 Paris
                Exposition. It is drawn from the same rows as Plain and Numbers.
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
                className="ds-datafig__numbers"
                role="region"
                aria-label={`Numbers for figure ${id}`}
                tabIndex={0}
              >
                {table}
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
