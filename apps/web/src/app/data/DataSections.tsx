/**
 * Data page body: on-page TOC, orientation beats, census population, Phase 1 indicator
 * visualizations (wealth, housing, justice), and Themes / Explore hand-offs.
 */
import Link from 'next/link';
import type {
  HistoricalStatePopulationCoverage,
  NationalPopulationTimelineRow,
  Phase1IndicatorCoverageSummary,
  StatePopulationChange,
} from '@repo/domain/statistics/public-data-summaries';
import type { DataPageIndicatorBundle } from '@repo/domain/statistics/data-page-series';
import { BlackPopulationShareChart } from '../../components/data/BlackPopulationShareChart';
import { DataStatStrip } from '../../components/data/DataStatStrip';
import { GroupedBarIndicatorChart } from '../../components/data/GroupedBarIndicatorChart';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import { RacePairComparisonChart } from '../../components/data/RacePairComparisonChart';
import { StatePopulationShift } from '../../components/data/StatePopulationShift';
import type { DataSourceRef } from '../../components/data/SourceFootnote';
import './data.css';

const PAGE_SECTIONS = [
  { id: 'orientation', label: 'Start here' },
  { id: 'population', label: 'Population' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'housing', label: 'Housing & credit' },
  { id: 'justice', label: 'Justice' },
  { id: 'themes', label: 'Themes' },
  { id: 'how-to-use', label: 'Next step' },
] as const;

const ORIENTATION_BEATS = [
  {
    kicker: 'National first',
    body: 'Census sections show the country-wide picture. Indicator charts zoom into published series we also use on Themes.',
  },
  {
    kicker: 'Sources visible',
    body: 'Every figure links to where it came from. Fixture-backed charts say so until warehouse ingest replaces them.',
  },
  {
    kicker: 'Gaps are not silence',
    body: 'Uneven coverage means the feed is incomplete, not that nothing happened. Juxtaposition is not causation.',
  },
] as const;

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

function DataUnavailable({ topic }: { readonly topic: string }) {
  return (
    <p className="ds-sans ds-data-page__empty">
      {topic} is not available on this release yet.{' '}
      <Link href="/explore">Open the map</Link> for place layers, or check back after the next
      update.
    </p>
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
    <div className="ds-data-page">
      <nav className="ds-data-page__nav" aria-labelledby="data-toc-title">
        <p className="ds-data-page__nav-title" id="data-toc-title">
          On this page
        </p>
        <ul className="ds-data-page__nav-list">
          {PAGE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="ds-data-page__nav-link" href={`#${section.id}`}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ds-entity-sections">
        <section
          className="ds-section ds-record-section ds-section--flush"
          aria-labelledby="orientation-heading"
          id="orientation"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Start here
          </p>
          <h2 className="ds-section__title" id="orientation-heading">
            How to read these numbers
          </h2>
          <p className="ds-section__lede">
            Census decades anchor the national story. Phase 1 indicators — ACS, NHGIS, HMDA, CHAS,
            BJS, SCF, USSC, and more — show the same metrics we juxtapose on{' '}
            <Link href="/themes">Themes</Link>. {servedFromNote}
          </p>
          <ul className="ds-data-page__beat-grid">
            {ORIENTATION_BEATS.map((beat) => (
              <li key={beat.kicker} className="ds-data-page__beat">
                <p className="ds-data-page__beat-kicker">{beat.kicker}</p>
                <p className="ds-data-page__beat-body">{beat.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="population-heading"
          id="population"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            U.S. Census
          </p>
          <h2 className="ds-section__title" id="population-heading">
            Black population over time
          </h2>
          <p className="ds-section__lede">
            How many Black Americans the Census counted each decade from 1790 to 2020 — the spine for
            national context before place-specific indicators.
          </p>
          {timelineRows.length > 0 ? (
            <>
              <div className="ds-data-section__viz ds-data-section__viz--pair">
                <PopulationByDecadeChart rows={timelineRows} sources={chartSources} />
                <BlackPopulationShareChart rows={timelineRows} sources={chartSources} />
              </div>
              {changeStripItems.length > 0 ? (
                <>
                  <h3 className="ds-data-page__subhead" id="population-change-heading">
                    Recent decade-to-decade change
                  </h3>
                  <DataStatStrip labelledBy="population-change-heading" items={changeStripItems} />
                  <p className="ds-sans ds-data-page__note">
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
                  <h3 className="ds-data-page__subhead" id="historical-state-coverage-heading">
                    Historical state tables (1790–1990)
                  </h3>
                  <DataStatStrip
                    labelledBy="historical-state-coverage-heading"
                    sources={[
                      {
                        label: 'U.S. Census Bureau, Working Paper 56 (state tables 15–65)',
                        url: historicalStates.sourceUrl,
                      },
                    ]}
                    items={[
                      {
                        id: 'hist-state-rows',
                        value: formatCount(historicalStates.rowCount),
                        label: 'State-by-decade records',
                        note: `${historicalStates.decadeMin}–${historicalStates.decadeMax}`,
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
        </section>

        <section className="ds-section ds-record-section" aria-labelledby="wealth-heading" id="wealth">
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Survey of Consumer Finances
          </p>
          <h2 className="ds-section__title" id="wealth-heading">
            Wealth gap at a glance
          </h2>
          <p className="ds-section__lede">
            Median family net worth from the Federal Reserve&apos;s triennial survey — a national
            juxtaposition used on the{' '}
            <Link href="/themes/redlining">redlining theme</Link> when asking how housing-credit eras
            relate to wealth.
          </p>
          <div className="ds-data-section__viz">
            <RacePairComparisonChart series={indicators.wealthComparison} />
          </div>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="housing-heading"
          id="housing"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            NHGIS · HMDA · CHAS
          </p>
          <h2 className="ds-section__title" id="housing-heading">
            Housing, credit, and cost burden
          </h2>
          <p className="ds-section__lede">
            Cook County is our Phase 1 place spine: decennial homeownership (NHGIS), mortgage denial
            rates (HMDA), and HUD CHAS cost burden from the Consolidated Plan — the same metrics
            bound to theme-impact question Q3 and Q4.
          </p>
          <div className="ds-data-section__viz">
            <GroupedBarIndicatorChart series={indicators.cookHomeownership} />
            <GroupedBarIndicatorChart series={indicators.hmdaDenialRates} />
            <RacePairComparisonChart series={indicators.costBurdenComparison} />
          </div>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="justice-heading"
          id="justice"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            BJS · USSC
          </p>
          <h2 className="ds-section__title" id="justice-heading">
            Imprisonment and federal drug sentences
          </h2>
          <p className="ds-section__lede">
            State imprisonment rates (BJS) and federal cocaine sentencing averages (USSC Quick Facts)
            — context for the{' '}
            <Link href="/themes/drug_policy_state">drug policy &amp; the state theme</Link>, not proof
            that any single law caused a number.
          </p>
          <div className="ds-data-section__viz">
            <RacePairComparisonChart series={indicators.imprisonmentComparison} />
            <GroupedBarIndicatorChart series={indicators.federalDrugSentences} />
          </div>
        </section>

        <section className="ds-section ds-record-section" aria-labelledby="themes-heading" id="themes">
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Theme-impact
          </p>
          <h2 className="ds-section__title" id="themes-heading">
            Same metrics, full stories
          </h2>
          <p className="ds-section__lede">
            Themes packages these indicators beside artifacts and policy eras. Data shows the
            numbers; Themes shows how we juxtapose them without causal overclaim.
          </p>
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
                      ? 'Catalog + fixtures until ingest completes'
                      : 'bb_reference statistical observations',
                },
              ]}
            />
          ) : null}
          <p className="ds-data-page__actions">
            <Link className="ds-cta ds-cta--copper" href="/themes/redlining">
              Redlining theme
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="/themes/drug_policy_state">
              Drug policy theme
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="/methodology">
              Juxtaposition rules
            </Link>
          </p>
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="how-to-use-heading"
          id="how-to-use"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Next step
          </p>
          <h2 className="ds-section__title" id="how-to-use-heading">
            Dig into a place
          </h2>
          <p className="ds-section__lede">
            Open the map for county layers and local context. Methodology explains how we read
            outside statistics next to archive records.
          </p>
          <p className="ds-data-page__actions">
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
        </section>
      </div>
    </div>
  );
}
