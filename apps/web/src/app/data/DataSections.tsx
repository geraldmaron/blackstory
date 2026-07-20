/**
 * Data page body: on-page TOC, orientation beats, numbered model sections
 * (census, ACS, hate crime, Opportunity Atlas), and Explore/methodology hand-offs.
 * Charts and citations stay in shared `components/data/*`; this file owns chrome
 * and reader-facing copy (plain language over modeling jargon).
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
  { id: 'orientation', label: 'Start here' },
  { id: 'population', label: 'Population' },
  { id: 'acs', label: 'Neighborhoods' },
  { id: 'hate-crime', label: 'Hate crime' },
  { id: 'mobility', label: 'Opportunity' },
  { id: 'how-to-use', label: 'Next step' },
] as const;

const ORIENTATION_BEATS = [
  {
    kicker: 'National first',
    body: 'This page is the country-wide picture. County maps and local layers live on Explore.',
  },
  {
    kicker: 'Sources visible',
    body: 'Every figure links to where it came from. If a number is missing, we say so.',
  },
  {
    kicker: 'Gaps are not silence',
    body: 'Uneven reporting or incomplete coverage means the feed is incomplete, not that nothing happened.',
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
            Start here
          </p>
          <h2 className="ds-section__title" id="orientation-heading">
            How to read these numbers
          </h2>
          <p className="ds-section__lede">
            Each section names who published the data, shows what we have loaded, and points to the
            map when you need a place view instead of a national summary.
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
            How many Black Americans the Census counted each decade from 1790 to 2020. Before the
            Civil War, counts separate free and enslaved people. Later decades report one Black
            total. Below that, you can see how the national count changed from one decade to the
            next, and which states gained or lost the most between 2010 and 2020.
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
                    Race labels on the Census have changed. Early counts split free and enslaved
                    people; later forms used different words for Black identity; and from 2000 the
                    Census allows more than one race. Those shifts mean older and newer totals are
                    not a perfect apples-to-apples line. The charts mark those boundaries instead of
                    hiding them.
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

        <section className="ds-section ds-record-section" aria-labelledby="acs-heading" id="acs">
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            American Community Survey
          </p>
          <h2 className="ds-section__title" id="acs-heading">
            Where neighborhood estimates are available
          </h2>
          <p className="ds-section__lede">
            The American Community Survey estimates income, housing, and education for counties and
            neighborhoods. Here we show how much of the country is covered in our archive, not a
            single national average of those estimates. Use Explore when you want the place view.
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
                    label: 'Counties with estimates',
                  },
                  {
                    id: 'acs-tracts',
                    value: formatCount(acs.tractCount),
                    label: 'Neighborhoods with estimates',
                    note: `${acs.vintage} five-year survey`,
                  },
                ]}
              />
            </>
          ) : (
            <DataUnavailable topic="Neighborhood estimate coverage" />
          )}
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="hate-crime-heading"
          id="hate-crime"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            FBI
          </p>
          <h2 className="ds-section__title" id="hate-crime-heading">
            Reported hate crimes
          </h2>
          <p className="ds-section__lede">
            What participating police agencies reported to the FBI. Not every agency joins the
            program, so an empty place can mean no report was filed, not that nothing happened.
          </p>
          <Notice
            className="ds-data-page__callout"
            tone="warning"
            title="Reporting is voluntary"
          >
            Agencies choose whether to send hate crime reports. Always read the incident counts next
            to the national participation rate below. That rate is the coverage context for every
            figure in this section.
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
                    label: `Reports filed in ${latestHateCrimeYear}`,
                  },
                  {
                    id: 'hc-anti-black',
                    value: formatCount(hateCrime.antiBlackIncidents),
                    label: 'Anti-Black bias reports',
                  },
                  ...(hateCrime.nationalParticipatingAgenciesPct !== undefined
                    ? [
                        {
                          id: 'hc-participation',
                          value: `${hateCrime.nationalParticipatingAgenciesPct}%`,
                          label: 'Agencies that reported nationally',
                          note: 'Read every count above next to this rate',
                        },
                      ]
                    : []),
                ]}
              />
            </>
          ) : (
            <DataUnavailable topic="Hate crime reporting figures" />
          )}
        </section>

        <section
          className="ds-section ds-record-section"
          aria-labelledby="mobility-heading"
          id="mobility"
        >
          <p className="ds-section__kicker">
            <span className="ds-kicker-index" aria-hidden="true" />
            Opportunity Atlas
          </p>
          <h2 className="ds-section__title" id="mobility-heading">
            Opportunity by neighborhood
          </h2>
          <p className="ds-section__lede">
            Research on how children from similar family incomes fare as adults, neighborhood by
            neighborhood. We show which places are covered. We do not mash those neighborhood ranks
            into one national average, because neighborhoods are different sizes and that average
            would mislead.
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
                    label: 'Neighborhoods covered',
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
            Dig into a place
          </h2>
          <p className="ds-section__lede">
            Open the map for county layers and local context. Methodology explains how we read
            outside statistics next to archive records, including voluntary reporting and coverage
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
