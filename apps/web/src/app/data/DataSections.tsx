/**
 * Data page body: on-page TOC, orientation beats, numbered model sections
 * (census, ACS, hate crime, Opportunity Atlas), and Explore/methodology hand-offs.
 * Charts and citations stay in shared `components/data/*`; this file owns chrome only.
 */
import Link from 'next/link';
import { Notice } from '@repo/ui';
import type {
  AcsCoverageSummary,
  HateCrimeYearSummary,
  HistoricalStatePopulationCoverage,
  NationalPopulationTimelineRow,
  OpportunityAtlasCoverageSummary,
  StatePopulationChange,
} from '@repo/firebase';
import { AcsCoverageChart } from '../../components/data/AcsCoverageChart';
import { BlackPopulationShareChart } from '../../components/data/BlackPopulationShareChart';
import { DataStatStrip } from '../../components/data/DataStatStrip';
import { HateCrimeCompositionChart } from '../../components/data/HateCrimeCompositionChart';
import { HateCrimeYearSeriesChart } from '../../components/data/HateCrimeYearSeriesChart';
import { OpportunityAtlasCoverageChart } from '../../components/data/OpportunityAtlasCoverageChart';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import { StatePopulationShift } from '../../components/data/StatePopulationShift';
import type { DataSourceRef } from '../../components/data/SourceFootnote';
import './data.css';

const PAGE_SECTIONS = [
  { id: 'orientation', label: 'Orientation' },
  { id: 'population', label: 'Population' },
  { id: 'acs', label: 'ACS' },
  { id: 'hate-crime', label: 'Hate crime' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'how-to-use', label: 'How to use' },
] as const;

const ORIENTATION_BEATS = [
  {
    kicker: 'Place first',
    body: 'National rollups sit here. County choropleths and alternate map models live on Explore.',
  },
  {
    kicker: 'Sources required',
    body: 'Every figure carries its citation. Absence of a number is stated; it is never filled in.',
  },
  {
    kicker: 'Coverage is not proof',
    body: 'Voluntary reporting and uneven ingest mean blank counties are about the feed, not the past.',
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
  readonly acs: AcsCoverageSummary | undefined;
  readonly hateCrime: HateCrimeYearSummary | undefined;
  readonly hateCrimeByYear: readonly HateCrimeYearSummary[];
  readonly latestHateCrimeYear: string;
  readonly opportunity: OpportunityAtlasCoverageSummary | undefined;
};

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function DataUnavailable({ topic }: { readonly topic: string }) {
  return (
    <p className="ds-sans ds-data-page__empty">
      {topic} is not loaded on this release yet.{' '}
      <Link href="/explore">Open Explore</Link> for place layers, or check back after the next
      published release.
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
  acs,
  hateCrime,
  hateCrimeByYear,
  latestHateCrimeYear,
  opportunity,
}: DataSectionsProps) {
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
            How to read
          </p>
          <h2 className="ds-section__title" id="orientation-heading">
            National numbers with a paper trail
          </h2>
          <p className="ds-section__lede">
            This page summarizes the modeling underneath the archive. Each section names the
            publisher, shows what is loaded, and points to the map when place detail is the right
            next step.
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
            Census Bureau
          </p>
          <h2 className="ds-section__title" id="population-heading">
            Black population by decade
          </h2>
          <p className="ds-section__lede">
            National Black population every decade from 1790 to 2020: free and enslaved counts from
            the 1790–1860 censuses, the single Black total afterward, and modern county-summed
            counts for 2000–2020. Historical figures come from Census Working Paper 56. The numbers
            below show recent decade-over-decade change.
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
                    Recent decade-over-decade change
                  </h3>
                  <DataStatStrip labelledBy="population-change-heading" items={changeStripItems} />
                  <p className="ds-sans ds-data-comparability-note">
                    Race categories change across two centuries: the 1790–1860 censuses split Black
                    population into free and enslaved counts; “Negro”/“colored” terminology gave way
                    to “Black”; and 2000 introduced the “Black or African American alone”
                    multiple-race methodology. Counts before and after 2000 are not perfectly
                    comparable, and 1870’s Southern count is a documented undercount. The charts
                    mark these boundaries rather than smoothing over them.
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
                    Historical state coverage (1790–1990)
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
                        label: 'State-decade rows',
                        note: `${historicalStates.decadeMin}–${historicalStates.decadeMax}`,
                      },
                      {
                        id: 'hist-state-count',
                        value: formatCount(historicalStates.stateCount),
                        label: 'States / D.C. covered',
                        note: 'Not every state appears every decade',
                      },
                    ]}
                  />
                </>
              ) : null}
            </>
          ) : (
            <DataUnavailable topic="Census population rollups" />
          )}
        </section>

        <section className="ds-section ds-record-section" aria-labelledby="acs-heading" id="acs">
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            American Community Survey
          </p>
          <h2 className="ds-section__title" id="acs-heading">
            ACS coverage (county and tract)
          </h2>
          <p className="ds-section__lede">
            Starter ACS fields (income, tenure, education, and related estimates) are ingested for
            map and modeling use. This page shows how much geography is covered, not national
            averages of those estimates. Open Explore when you need place-level context from the
            same ingest.
          </p>
          {acs ? (
            <>
              <div className="ds-data-section__viz">
                <AcsCoverageChart coverage={acs} />
              </div>
              <DataStatStrip
                labelledBy="acs-heading"
                sources={[{ label: acs.source, url: acs.sourceUrl }]}
                items={[
                  {
                    id: 'acs-counties',
                    value: formatCount(acs.countyCount),
                    label: 'Counties covered',
                  },
                  {
                    id: 'acs-tracts',
                    value: formatCount(acs.tractCount),
                    label: 'Census tracts covered',
                    note: `ACS ${acs.vintage} 5-year estimates`,
                  },
                ]}
              />
            </>
          ) : (
            <DataUnavailable topic="ACS coverage counts" />
          )}
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="hate-crime-heading"
          id="hate-crime"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            FBI Uniform Crime Reporting
          </p>
          <h2 className="ds-section__title" id="hate-crime-heading">
            Hate crime reporting
          </h2>
          <p className="ds-section__lede">
            National UCR hate crime series used for civil-rights context. Read every count beside
            participation: agencies choose whether to report.
          </p>
          <Notice
            className="ds-data-page__callout"
            tone="warning"
            title="Reporting is voluntary"
          >
            Participation in the UCR hate crime program is voluntary for law enforcement agencies. A
            county with no reported incidents means no participating agency reported one that year.
            It is a fact about reporting, not a claim that nothing happened. Always read these
            counts beside the national participation rate below.
          </Notice>
          {hateCrime ? (
            <>
              {hateCrimeByYear.length > 1 ? (
                <div className="ds-data-section__viz">
                  <HateCrimeYearSeriesChart summaries={hateCrimeByYear} />
                </div>
              ) : null}
              <div className="ds-data-section__viz">
                <HateCrimeCompositionChart summary={hateCrime} />
              </div>
              <DataStatStrip
                labelledBy="hate-crime-heading"
                sources={[{ label: hateCrime.source, url: hateCrime.sourceUrl }]}
                items={[
                  {
                    id: 'hc-incidents',
                    value: formatCount(hateCrime.incidents),
                    label: `Reported incidents, ${latestHateCrimeYear}`,
                  },
                  {
                    id: 'hc-anti-black',
                    value: formatCount(hateCrime.antiBlackIncidents),
                    label: 'Anti-Black or African American bias',
                  },
                  ...(hateCrime.nationalParticipatingAgenciesPct !== undefined
                    ? [
                        {
                          id: 'hc-participation',
                          value: `${hateCrime.nationalParticipatingAgenciesPct}%`,
                          label: 'Agencies participating nationally',
                          note: 'the coverage denominator; read every count above beside this figure',
                        },
                      ]
                    : []),
                ]}
              />
            </>
          ) : (
            <DataUnavailable topic="FBI hate crime summaries" />
          )}
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="mobility-heading"
          id="mobility"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Opportunity Insights
          </p>
          <h2 className="ds-section__title" id="mobility-heading">
            Economic mobility by tract
          </h2>
          <p className="ds-section__lede">
            Household income rank in adulthood by race and parental income percentile, from the
            Opportunity Atlas. Measures are tract-level. We do not publish a national average of
            percentile ranks across differently sized tracts, because that average would itself be a
            fabricated statistic. Coverage of the ingest is what this section shows.
          </p>
          {opportunity ? (
            <>
              <div className="ds-data-section__viz">
                <OpportunityAtlasCoverageChart coverage={opportunity} />
              </div>
              <DataStatStrip
                labelledBy="mobility-heading"
                sources={[{ label: opportunity.source, url: opportunity.sourceUrl }]}
                items={[
                  {
                    id: 'oa-tracts',
                    value: formatCount(opportunity.tractCount),
                    label: 'Tracts covered (2010 geography)',
                    note: opportunity.license,
                  },
                ]}
              />
            </>
          ) : (
            <DataUnavailable topic="Opportunity Atlas coverage" />
          )}
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
            From national rollups to place
          </h2>
          <p className="ds-section__lede">
            County choropleths and layer models belong on the map. Methodology explains how external
            statistics are read beside archive records, including voluntary reporting and coverage
            gaps.
          </p>
          <p className="ds-data-page__actions">
            <Link className="ds-cta ds-cta--copper" href="/explore">
              Explore the map
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="/methodology">
              Read methodology
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
