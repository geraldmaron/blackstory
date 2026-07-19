/**
 * Data page: the modeling built on top of the archive — census population, ACS estimates,
 * FBI hate crime reporting, and Opportunity Atlas economic-mobility coverage — shown as
 * national rollups with mandatory source citations (public-numeric-policy category 3).
 *
 * Population section: one chart of decennial levels (counts + share annotation) plus a strip
 * of decade-over-decade Δ Black / Δ share and a state movers list — not a triple listing of
 * the same levels. County choropleth detail lives on Explore map layer models.
 *
 * HOLC (Mapping Inequality) is deliberately absent — CC BY-NC-SA rights hold.
 */
import { US_STATES } from '@repo/domain/map/geography';
import {
  buildStateFipsNameMap,
  getAcsCoverageSummary,
  getHateCrimeYearSummaries,
  getHateCrimeYearSummary,
  getNationalPopulationByDecade,
  getNationalPopulationChanges,
  getOpportunityAtlasCoverageSummary,
  getStatePopulationChanges,
  type AcsCoverageSummary,
  type HateCrimeYearSummary,
  type OpportunityAtlasCoverageSummary,
  type PopulationDecadeChange,
  type StatePopulationChange,
} from '@repo/firebase';
import { Notice } from '@repo/ui';
import { AcsCoverageChart } from '../../components/data/AcsCoverageChart';
import { DataStatStrip } from '../../components/data/DataStatStrip';
import { HateCrimeCompositionChart } from '../../components/data/HateCrimeCompositionChart';
import { HateCrimeYearSeriesChart } from '../../components/data/HateCrimeYearSeriesChart';
import { OpportunityAtlasCoverageChart } from '../../components/data/OpportunityAtlasCoverageChart';
import { nationalChangeStripItems } from '../../components/data/population-change';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import { StatePopulationShift } from '../../components/data/StatePopulationShift';
import '../../components/data/data-charts.css';

export const metadata = {
  title: 'Data',
  description:
    'Census, ACS, FBI hate crime, and economic-mobility modeling behind the archive — national rollups with full source citations.',
};

/** Most recent data year with a complete annual FBI UCR release at time of writing. */
const LATEST_HATE_CRIME_YEAR = '2024';

/** Years shown on the multi-year reporting metrics chart — each year fetched separately. */
const HATE_CRIME_SERIES_YEARS = ['2010', '2015', '2020', '2021', '2022', '2023', '2024'] as const;

async function safe<T>(promise: Promise<T | undefined>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

const STATE_NAME_BY_FIPS = buildStateFipsNameMap(US_STATES);

export default async function DataPage() {
  const [
    populationByDecade,
    populationChanges,
    stateChanges2010to2020,
    acsCoverage,
    hateCrimeYear,
    hateCrimeSeries,
    opportunityAtlasCoverage,
  ] = await Promise.all([
    safe(getNationalPopulationByDecade()),
    safe(getNationalPopulationChanges()),
    safe(getStatePopulationChanges('2010', '2020')),
    safe(getAcsCoverageSummary()),
    safe(getHateCrimeYearSummary(LATEST_HATE_CRIME_YEAR)),
    safe(getHateCrimeYearSummaries(HATE_CRIME_SERIES_YEARS)),
    safe(getOpportunityAtlasCoverageSummary()),
  ]);

  const hateCrime = hateCrimeYear as HateCrimeYearSummary | undefined;
  const hateCrimeByYear = (hateCrimeSeries ?? []) as readonly HateCrimeYearSummary[];
  const acs = acsCoverage as AcsCoverageSummary | undefined;
  const opportunity = opportunityAtlasCoverage as OpportunityAtlasCoverageSummary | undefined;
  const changes = (populationChanges ?? []) as readonly PopulationDecadeChange[];
  const stateChanges = (stateChanges2010to2020 ?? []) as readonly StatePopulationChange[];
  const changeStripItems = nationalChangeStripItems(changes);
  const comparabilityNote = changes[0]?.comparabilityNote;

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Modeling</p>
      <h1 className="ds-page__title">Data behind the archive</h1>
      <p className="ds-page__lede">
        The national numbers underneath BlackStory&rsquo;s map and records — population shift,
        economic, and civil-rights context, each carrying the exact source it came from.
        County choropleths and alternate map models live on Explore; this page is the
        national-scale summary and the paper trail.
      </p>

      <section className="ds-section" aria-labelledby="population-heading">
        <p className="ds-section__kicker">Census Bureau</p>
        <h2 className="ds-section__title" id="population-heading">
          Black population by decade
        </h2>
        <p className="ds-section__lede">
          Decennial Black alone counts for every U.S. county (2000–2020), joined by 5-digit FIPS.
          The chart shows levels; the figures below show decade-over-decade change.
        </p>
        {populationByDecade && populationByDecade.length > 0 ? (
          <>
            <div className="ds-data-section__viz">
              <PopulationByDecadeChart rows={populationByDecade} />
            </div>
            {changeStripItems.length > 0 ? (
              <>
                <h3 className="ds-sans" id="population-change-heading">
                  Decade-over-decade change
                </h3>
                <DataStatStrip labelledBy="population-change-heading" items={changeStripItems} />
                {comparabilityNote ? (
                  <p className="ds-sans ds-data-comparability-note">{comparabilityNote}</p>
                ) : null}
              </>
            ) : null}
            {stateChanges.length > 0 ? (
              <StatePopulationShift
                fromDecade="2010"
                toDecade="2020"
                changes={stateChanges}
                stateNameByFips={STATE_NAME_BY_FIPS}
                labelledBy="population-heading"
              />
            ) : null}
          </>
        ) : (
          <p className="ds-sans">Census data is not available in this environment yet.</p>
        )}
      </section>

      <section className="ds-section" aria-labelledby="acs-heading">
        <p className="ds-section__kicker">American Community Survey</p>
        <h2 className="ds-section__title" id="acs-heading">
          ACS coverage (county and tract profiles)
        </h2>
        <p className="ds-section__lede">
          Starter estimate fields — income, tenure, education, and related ACS variables — are
          ingested for map and modeling use. This page shows coverage counts only until metric
          rollups ship here; it does not yet publish those estimate values nationally.
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
          <p className="ds-sans">ACS data is not available in this environment yet.</p>
        )}
      </section>

      <section className="ds-section" aria-labelledby="hate-crime-heading">
        <p className="ds-section__kicker">FBI Uniform Crime Reporting</p>
        <h2 className="ds-section__title" id="hate-crime-heading">
          Hate crime reporting
        </h2>
        <Notice tone="warning" title="Reporting is voluntary">
          Participation in the UCR hate crime program is voluntary for law enforcement agencies.
          A county with no reported incidents means no participating agency reported one that
          year &mdash; it is a fact about reporting, not a claim that nothing happened. Always
          read these counts beside the national participation rate below.
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
                  label: `Reported incidents, ${LATEST_HATE_CRIME_YEAR}`,
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
                        note: 'the coverage denominator — read every count above beside this figure',
                      },
                    ]
                  : []),
              ]}
            />
          </>
        ) : (
          <p className="ds-sans">FBI hate crime data is not available in this environment yet.</p>
        )}
      </section>

      <section className="ds-section" aria-labelledby="mobility-heading">
        <p className="ds-section__kicker">Opportunity Insights</p>
        <h2 className="ds-section__title" id="mobility-heading">
          Economic mobility by tract
        </h2>
        <p className="ds-section__lede">
          Household income rank in adulthood by race and parental income percentile, from the
          Opportunity Atlas &mdash; tract-level, not a national average (averaging percentile
          ranks across differently sized tracts would itself be a fabricated statistic, so we
          don&rsquo;t publish one here).
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
          <p className="ds-sans">Opportunity Atlas data is not available in this environment yet.</p>
        )}
      </section>
    </main>
  );
}
