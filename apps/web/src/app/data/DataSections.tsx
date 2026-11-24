/**
 * `/data` body: a sticky contents list on desktop beside the figures, grouped under plain section
 * headings: Population, Lives (a link to its own page), Measured gaps (wealth, housing, justice)
 * and How to read.
 *
 * Every figure is a registry figure (`components/data/figures`): three views behind one switch,
 * Plain by default, each figure keeping its own view. This file decides order and grouping; it
 * draws nothing of its own. The whole page is one paper sheet: no color bands, no count set in
 * display type (docs/ui/DESIGN.md rules 4 and 5).
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { SectionHeading, buttonClassName } from '@repo/ui';
import { TrustSheet } from '../../components/trust';
import { DataContents, type ContentsGroup } from '../../components/data/DataContents';
import { Figure } from '../../components/data/figures/Figure';
import {
  FIGURES,
  figurePagePath,
  type FigureId,
  type FigureViews,
} from '../../components/data/figures/registry';
import {
  DATA_FIGURE_GROUPS,
  DATA_GAP_GROUPS,
  DATA_LEGACY_ANCHORS,
  DATA_PAGE_SECTIONS,
  DATA_READING_LINKS,
  DATA_READING_RULES,
  DATA_SECTION_COPY,
  DATA_SOURCE_LIBRARY_HANDOFF,
  type DataPageSectionId,
} from './data-copy';

void React;

export type DataSectionsProps = {
  /** The figures with something to draw in this release. */
  readonly figures: readonly FigureId[];
  readonly populationAsOf: string;
  readonly indicatorsAsOf: string;
  /** The page's `view` URL parameter: each figure's own view. */
  readonly views: FigureViews;
};

function Section({
  id,
  meta,
  children,
}: {
  readonly id: DataPageSectionId;
  readonly meta?: string;
  readonly children: ReactNode;
}) {
  const copy = DATA_SECTION_COPY[id];
  return (
    <section className="ds-data-section" id={id} aria-labelledby={`${id}-heading`}>
      <header className="ds-data-section__head">
        <SectionHeading id={`${id}-heading`}>{copy.title}</SectionHeading>
        <p className="ds-data-section__lede">{copy.lede}</p>
        {meta ? <p className="ds-data-section__meta">{meta}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function DataSections({
  figures,
  populationAsOf,
  indicatorsAsOf,
  views,
}: DataSectionsProps) {
  const inGroup = (group: keyof typeof DATA_FIGURE_GROUPS) =>
    DATA_FIGURE_GROUPS[group].filter((id) => figures.includes(id));
  const drawn = (ids: readonly FigureId[]) => (
    <div className="ds-data-figures">
      {ids.map((id) => (
        <React.Fragment key={id}>
          {/* The address this figure had before it had an id; old links still land on it. */}
          {DATA_LEGACY_ANCHORS[id] ? (
            <span id={DATA_LEGACY_ANCHORS[id]} className="ds-data-figures__was" />
          ) : null}
          <Figure
            id={id}
            views={views}
            elsewhere={{ href: figurePagePath(id), label: `Figure ${id} on its own page` }}
          />
        </React.Fragment>
      ))}
    </div>
  );

  const population = inGroup('counted');
  const contents: ContentsGroup[] = DATA_PAGE_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    figures:
      section.id === 'counted'
        ? population.map((id) => ({ id, label: FIGURES[id].name }))
        : section.id === 'gaps'
          ? DATA_GAP_GROUPS.map((group) => ({ id: group.id, label: group.label }))
          : [],
  }));

  return (
    <TrustSheet>
      <div className="ds-data-layout">
        <div className="ds-data-layout__rail">
          <DataContents
            groups={contents}
            notes={[`Census as of ${populationAsOf}`, `Indicators as of ${indicatorsAsOf}`]}
          />
        </div>

        <div className="ds-data-layout__main">
          <Section id="counted" meta={`Census figures as of ${populationAsOf}`}>
            {population.length > 0 ? (
              drawn(population)
            ) : (
              <p className="ds-data-empty">
                Census population figures are not available in this release. The figures below are
                unaffected.
              </p>
            )}
          </Section>

          <Section id="lives">
            <p className="ds-data-door">
              <Link className="ds-data-door__link" href="/lives">
                Open Lives
              </Link>
              <span className="ds-data-door__line">
                Every decade and region, with the cited tables.
              </span>
            </p>
          </Section>

          <Section id="gaps" meta={`Indicators as of ${indicatorsAsOf}`}>
            {DATA_GAP_GROUPS.map((group) => (
              <section
                key={group.id}
                id={group.id}
                className="ds-data-group"
                aria-labelledby={`${group.id}-heading`}
              >
                <h3 className="ds-data-group__title" id={`${group.id}-heading`}>
                  {group.label}
                </h3>
                {drawn(inGroup(group.id))}
              </section>
            ))}
          </Section>

          <Section id="reading">
            <ul className="ds-data-rules">
              {DATA_READING_RULES.map((rule) => (
                <li key={rule.title} className="ds-data-rule">
                  <h3 className="ds-data-rule__title">{rule.title}</h3>
                  <p className="ds-data-rule__body">{rule.body}</p>
                </li>
              ))}
            </ul>
            <p className="ds-data-reading__links">
              <Link
                className={buttonClassName('secondary')}
                href={DATA_SOURCE_LIBRARY_HANDOFF.href}
              >
                {DATA_SOURCE_LIBRARY_HANDOFF.label}
              </Link>
              {DATA_READING_LINKS.map((link) => (
                <Link key={link.href} className={buttonClassName('quiet')} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </p>
          </Section>
        </div>
      </div>
    </TrustSheet>
  );
}
