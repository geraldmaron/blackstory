/**
 * Data page body: v6 Surface edition stack with census population, Phase 1 indicator
 * visualizations, theme hand-offs, and explore/methodology next steps.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import type {
  HistoricalStatePopulationCoverage,
  NationalPopulationTimelineRow,
  Phase1IndicatorCoverageSummary,
  StatePopulationChange,
} from '@repo/domain/statistics/public-data-summaries';
import type { DataPageIndicatorBundle } from '@repo/domain/statistics/data-page-series';
import { ATMOSPHERE_ATTRIBUTION_HREF } from '../../components/atmosphere/tile-credits';
import { BlackPopulationShareChart } from '../../components/data/BlackPopulationShareChart';
import { DataStatStrip } from '../../components/data/DataStatStrip';
import { GroupedBarIndicatorChart } from '../../components/data/GroupedBarIndicatorChart';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import { RacePairComparisonChart } from '../../components/data/RacePairComparisonChart';
import { StatePopulationShift } from '../../components/data/StatePopulationShift';
import type { DataSourceRef } from '../../components/data/SourceFootnote';
import {
  DATA_INTRO,
  DATA_ORIENTATION_BEATS,
  DATA_PAGE_SECTIONS,
  DATA_SECTION_COPY,
} from './data-copy';
import {
  dataEditionPanelClassName,
  dataEditionStackClassName,
} from './data-panel-chrome';
import './data-edition.css';

export type DataStatStripItem = {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly note?: string;
  readonly sources?: readonly DataSourceRef[];
};

export type DataSectionsProps = {
  readonly timelineRows: readonly NationalPopulationTimelineRow[];
  readonly chartSources: readonly DataSourceRef[];
  readonly changeStripItems: readonly DataStatStripItem[];
  readonly stateChanges: readonly StatePopulationChange[];
  readonly stateNameByFips: Readonly<Record<string, string>>;
  readonly historicalStates: HistoricalStatePopulationCoverage | undefined;
  readonly phase1Indicators: Phase1IndicatorCoverageSummary | undefined;
  readonly indicators: DataPageIndicatorBundle;
};

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function formatDecadeRange(min: string, max: string): string {
  return `${min} to ${max}`;
}

function DataUnavailable({ topic }: { readonly topic: string }) {
  return (
    <p className="ds-data-edition__empty">
      {topic} is not available on this release yet.{' '}
      <Link href="/explore">Open the map</Link> for place layers, or check back after the next
      update.
    </p>
  );
}

type EditionHeaderProps = {
  readonly index: string;
  readonly kicker: string;
  readonly title: ReactNode;
  readonly lede?: ReactNode;
  readonly headingId: string;
  readonly titleTag?: 'h1' | 'h2';
};

function DataEditionHeader({
  index,
  kicker,
  title,
  lede,
  headingId,
  titleTag = 'h2',
}: EditionHeaderProps) {
  const TitleTag = titleTag;
  return (
    <header className="ds-data-edition__header">
      <span className="ds-data-edition__index" aria-hidden="true">
        {index}
      </span>
      <div>
        <p className="ds-data-edition__kicker">{kicker}</p>
        <TitleTag className="ds-data-edition__title" id={headingId}>
          {title}
        </TitleTag>
        {lede ? <p className="ds-data-edition__lede">{lede}</p> : null}
      </div>
    </header>
  );
}

export function DataSections({
  timelineRows,
  chartSources,
  changeStripItems,
  stateChanges,
  stateNameByFips,
  historicalStates,
  phase1Indicators,
  indicators,
}: DataSectionsProps) {
  const servedFromNote =
    indicators.servedFrom === 'fixture'
      ? 'Charts below use verified Phase 1 fixtures until live warehouse rows replace them.'
      : 'Charts below read from the reference indicator warehouse when available.';

  return (
    <div className={dataEditionStackClassName()}>
      <article className={dataEditionPanelClassName('intro')}>
        <DataEditionHeader
          index="00"
          kicker={DATA_INTRO.kicker}
          title={
            <>
              Data behind the <em>archive</em>.
            </>
          }
          lede={DATA_INTRO.lede}
          headingId="data-intro-heading"
          titleTag="h1"
        />
        <p className="ds-data-edition__actions">
          <Link className="ds-cta ds-cta--quiet" href="/methodology">
            Juxtaposition rules
          </Link>
        </p>
        <p className="ds-data-edition__credit">
          Archive mosaic · symbolic atmosphere · decorative gutter tiles only.{' '}
          <Link href={ATMOSPHERE_ATTRIBUTION_HREF}>Mosaic credits</Link>
        </p>
      </article>

      <article
        className={dataEditionPanelClassName('orientation')}
        aria-labelledby="orientation-heading"
        id="orientation"
      >
        <DataEditionHeader
          index={DATA_SECTION_COPY.orientation.index}
          kicker={DATA_SECTION_COPY.orientation.kicker}
          title={DATA_SECTION_COPY.orientation.title}
          lede={`${DATA_SECTION_COPY.orientation.lede} ${servedFromNote}`}
          headingId="orientation-heading"
        />
        <ul className="ds-data-edition__beat-grid">
          {DATA_ORIENTATION_BEATS.map((beat) => (
            <li key={beat.kicker} className="ds-data-edition__beat">
              <p className="ds-data-edition__beat-kicker">{beat.kicker}</p>
              <p className="ds-data-edition__beat-body">{beat.body}</p>
            </li>
          ))}
        </ul>
        <nav className="ds-data-edition__nav" aria-labelledby="data-toc-title">
          <p className="ds-data-edition__nav-title" id="data-toc-title">
            On this page
          </p>
          <ul className="ds-data-edition__nav-list">
            {DATA_PAGE_SECTIONS.filter((section) => section.id !== 'orientation').map((section) => (
              <li key={section.id}>
                <a className="ds-data-edition__nav-link" href={`#${section.id}`}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </article>

      <article
        className={dataEditionPanelClassName('population')}
        aria-labelledby="population-heading"
        id="population"
      >
        <DataEditionHeader
          index={DATA_SECTION_COPY.population.index}
          kicker={DATA_SECTION_COPY.population.kicker}
          title={DATA_SECTION_COPY.population.title}
          lede={DATA_SECTION_COPY.population.lede}
          headingId="population-heading"
        />
        {timelineRows.length > 0 ? (
          <>
            <div className="ds-data-edition__viz ds-data-edition__viz--pair">
              <PopulationByDecadeChart rows={timelineRows} sources={chartSources} />
              <BlackPopulationShareChart rows={timelineRows} sources={chartSources} />
            </div>
            {changeStripItems.length > 0 ? (
              <>
                <h3 className="ds-data-edition__subhead" id="population-change-heading">
                  Recent decade-to-decade change
                </h3>
                <DataStatStrip labelledBy="population-change-heading" items={changeStripItems} />
                <p className="ds-data-edition__note">
                  Race labels on the Census have changed. The charts mark definition boundaries
                  instead of hiding them.
                </p>
              </>
            ) : null}
            {stateChanges.length > 0 ? (
              <StatePopulationShift
                fromDecade="2010"
                toDecade="2020"
                changes={stateChanges}
                stateNameByFips={stateNameByFips}
                labelledBy="population-heading"
              />
            ) : null}
            {historicalStates ? (
              <>
                <h3 className="ds-data-edition__subhead" id="historical-state-coverage-heading">
                  Historical state tables (1790 to 1990)
                </h3>
                <DataStatStrip
                  labelledBy="historical-state-coverage-heading"
                  sources={[
                    {
                      label: 'U.S. Census Bureau, Working Paper 56 (state tables 15 to 65)',
                      url: historicalStates.sourceUrl,
                    },
                  ]}
                  items={[
                    {
                      id: 'hist-state-rows',
                      value: formatCount(historicalStates.rowCount),
                      label: 'State-by-decade records',
                      note: formatDecadeRange(
                        historicalStates.decadeMin,
                        historicalStates.decadeMax,
                      ),
                    },
                    {
                      id: 'hist-state-count',
                      value: formatCount(historicalStates.stateCount),
                      label: 'States and D.C. included',
                      note: 'Not every state appears in every decade',
                    },
                  ]}
                />
              </>
            ) : null}
          </>
        ) : (
          <DataUnavailable topic="Census population figures" />
        )}
      </article>

      <article
        className={dataEditionPanelClassName('wealth')}
        aria-labelledby="wealth-heading"
        id="wealth"
      >
        <DataEditionHeader
          index={DATA_SECTION_COPY.wealth.index}
          kicker={DATA_SECTION_COPY.wealth.kicker}
          title={DATA_SECTION_COPY.wealth.title}
          lede={
            <>
              Median family net worth from the Federal Reserve&apos;s triennial survey: a national
              juxtaposition used on the{' '}
              <Link href="/themes/redlining">redlining theme</Link> when asking how housing-credit
              eras relate to wealth.
            </>
          }
          headingId="wealth-heading"
        />
        <div className="ds-data-edition__viz">
          <RacePairComparisonChart series={indicators.wealthComparison} />
        </div>
      </article>

      <article
        className={dataEditionPanelClassName('housing')}
        aria-labelledby="housing-heading"
        id="housing"
      >
        <DataEditionHeader
          index={DATA_SECTION_COPY.housing.index}
          kicker={DATA_SECTION_COPY.housing.kicker}
          title={DATA_SECTION_COPY.housing.title}
          lede={DATA_SECTION_COPY.housing.lede}
          headingId="housing-heading"
        />
        <div className="ds-data-edition__viz">
          <GroupedBarIndicatorChart series={indicators.cookHomeownership} />
          <GroupedBarIndicatorChart series={indicators.hmdaDenialRates} />
          <RacePairComparisonChart series={indicators.costBurdenComparison} />
        </div>
      </article>

      <article
        className={dataEditionPanelClassName('justice')}
        aria-labelledby="justice-heading"
        id="justice"
      >
        <DataEditionHeader
          index={DATA_SECTION_COPY.justice.index}
          kicker={DATA_SECTION_COPY.justice.kicker}
          title={DATA_SECTION_COPY.justice.title}
          lede={
            <>
              State imprisonment rates (BJS) and federal cocaine sentencing averages (USSC Quick
              Facts): context for the{' '}
              <Link href="/themes/drug_policy_state">drug policy and the state theme</Link>, not
              proof that any single law caused a number.
            </>
          }
          headingId="justice-heading"
        />
        <div className="ds-data-edition__viz">
          <RacePairComparisonChart series={indicators.imprisonmentComparison} />
          <GroupedBarIndicatorChart series={indicators.federalDrugSentences} />
        </div>
      </article>

      <article
        className={dataEditionPanelClassName('themes')}
        aria-labelledby="themes-heading"
        id="themes"
      >
        <DataEditionHeader
          index={DATA_SECTION_COPY.themes.index}
          kicker={DATA_SECTION_COPY.themes.kicker}
          title={DATA_SECTION_COPY.themes.title}
          lede={DATA_SECTION_COPY.themes.lede}
          headingId="themes-heading"
        />
        {phase1Indicators ? (
          <DataStatStrip
            labelledBy="themes-heading"
            sources={[
              {
                label: 'Phase 1 indicator catalog',
                url: '/methodology',
              },
            ]}
            items={[
              {
                id: 'p1-metrics',
                value: formatCount(phase1Indicators.metricCount),
                label: 'Curated metrics defined',
                note: phase1Indicators.themes.join(', '),
              },
              {
                id: 'p1-obs',
                value: formatCount(phase1Indicators.sampleObservationCount),
                label: 'Warehouse observations loaded',
                note:
                  phase1Indicators.sampleObservationCount === 0
                    ? 'Catalog and fixtures until ingest completes'
                    : 'bb_reference statistical observations',
              },
            ]}
          />
        ) : null}
        <p className="ds-data-edition__actions">
          <Link className="ds-cta ds-cta--quiet" href="/themes/redlining">
            Redlining theme
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/themes/drug_policy_state">
            Drug policy theme
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/methodology">
            Juxtaposition rules
          </Link>
        </p>
      </article>

      <article
        className={dataEditionPanelClassName('next')}
        aria-labelledby="how-to-use-heading"
        id="next"
      >
        <DataEditionHeader
          index={DATA_SECTION_COPY.next.index}
          kicker={DATA_SECTION_COPY.next.kicker}
          title={DATA_SECTION_COPY.next.title}
          lede={DATA_SECTION_COPY.next.lede}
          headingId="how-to-use-heading"
        />
        <p className="ds-data-edition__actions">
          <Link className="ds-cta ds-cta--copper" href="/explore">
            Explore the map
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/methodology">
            Read methodology
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="/books">
            Banned books
          </Link>
        </p>
      </article>
    </div>
  );
}
