/**
 * Data page: the modeling built on top of the archive — census population, ACS estimates,
 * FBI hate crime reporting, and Opportunity Atlas economic-mobility coverage — shown as
 * national rollups with mandatory source citations (public-numeric-policy category 3).
 *
 * Every number here is a server-side AGGREGATE (`@blap/firebase`'s national-stats readers),
 * never a per-record dump; the per-county/per-tract detail lives on the Explore map's
 * upcoming choropleth layer (black-book-vxz), not here. Reads use the Admin SDK directly
 * (bypasses the client-facing Firestore rules that keep some of these collections closed to
 * browsers) and fail soft: a reader returning nothing renders "not yet available," never a
 * fabricated zero.
 *
 * HOLC (Mapping Inequality) is deliberately absent from this page — its vector dataset is
 * CC BY-NC-SA and stays off every public surface until a rights review clears a specific
 * public treatment (see @blap/domain's launch-corpora.ts).
 */
import {
  getAcsCoverageSummary,
  getHateCrimeYearSummary,
  getNationalPopulationByDecade,
  getOpportunityAtlasCoverageSummary,
  type AcsCoverageSummary,
  type HateCrimeYearSummary,
  type NationalPopulationByDecade,
  type OpportunityAtlasCoverageSummary,
} from '@blap/firebase';
import { Notice } from '@blap/ui';
import { AcsCoverageChart } from '../../components/data/AcsCoverageChart';
import { BlackPopulationShareChart } from '../../components/data/BlackPopulationShareChart';
import { DataStatCitation } from '../../components/data/DataStatCitation';
import { HateCrimeCompositionChart } from '../../components/data/HateCrimeCompositionChart';
import { PopulationByDecadeChart } from '../../components/data/PopulationByDecadeChart';
import '../../components/data/data-charts.css';

export const metadata = {
  title: 'Data',
  description:
    'Census, ACS, FBI hate crime, and economic-mobility modeling behind the archive — national rollups with full source citations.',
};

/** Most recent data year with a complete annual FBI UCR release at time of writing. */
const LATEST_HATE_CRIME_YEAR = '2024';

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

export default async function DataPage() {
  const [populationByDecade, acsCoverage, hateCrimeYear, opportunityAtlasCoverage] = await Promise.all([
    safe(getNationalPopulationByDecade()),
    safe(getAcsCoverageSummary()),
    safe(getHateCrimeYearSummary(LATEST_HATE_CRIME_YEAR)),
    safe(getOpportunityAtlasCoverageSummary()),
  ]);

  return (
    <main className="bp-container bp-page" id="main">
      <p className="bp-page__eyebrow">Modeling</p>
      <h1 className="bp-page__title">Data behind the archive</h1>
      <p className="bp-page__lede">
        The national numbers underneath Blap&rsquo;s map and records — population, economic, and
        civil-rights context, each carrying the exact source it came from. County- and
        tract-level detail is landing on the Explore map as a choropleth layer; this page is the
        national-scale summary and the paper trail.
      </p>

      <section className="bp-section" aria-labelledby="population-heading">
        <p className="bp-section__kicker">Census Bureau</p>
        <h2 className="bp-section__title" id="population-heading">
          Black population by decade
        </h2>
        <p className="bp-section__lede">
          Decennial counts for every U.S. county, joined by 5-digit FIPS code to every other
          dataset on this page.
        </p>
        {populationByDecade && populationByDecade.length > 0 ? (
          <>
            <div className="bp-data-section__viz bp-data-section__viz--pair">
              <PopulationByDecadeChart rows={populationByDecade} />
              <BlackPopulationShareChart rows={populationByDecade} />
            </div>
            <ul className="bp-data-strip">
            {populationByDecade.map((row: NationalPopulationByDecade) => (
              <DataStatCitation
                key={row.decade}
                value={formatCount(row.blackPopulation)}
                label={`Black population, ${row.decade} census`}
                note={`of ${formatCount(row.totalPopulation)} total population across ${formatCount(row.countyCount)} counties`}
                sourceLabel={row.source}
                sourceUrl={row.sourceUrl}
              />
            ))}
            </ul>
          </>
        ) : (
          <p className="bp-sans">Census data is not available in this environment yet.</p>
        )}
      </section>

      <section className="bp-section" aria-labelledby="acs-heading">
        <p className="bp-section__kicker">American Community Survey</p>
        <h2 className="bp-section__title" id="acs-heading">
          Income, education, and housing (5-year estimates)
        </h2>
        <p className="bp-section__lede">
          Median household income, tenure, and educational attainment — including a
          Black-householder income breakout — at county and tract level.
        </p>
        {acsCoverage ? (
          <>
            <div className="bp-data-section__viz">
              <AcsCoverageChart coverage={acsCoverage as AcsCoverageSummary} />
            </div>
            <ul className="bp-data-strip">
            <DataStatCitation
              value={formatCount((acsCoverage as AcsCoverageSummary).countyCount)}
              label="Counties covered"
              sourceLabel={acsCoverage.source}
              sourceUrl={acsCoverage.sourceUrl}
            />
            <DataStatCitation
              value={formatCount((acsCoverage as AcsCoverageSummary).tractCount)}
              label="Census tracts covered"
              note={`ACS ${(acsCoverage as AcsCoverageSummary).vintage} 5-year estimates`}
              sourceLabel={acsCoverage.source}
              sourceUrl={acsCoverage.sourceUrl}
            />
            </ul>
          </>
        ) : (
          <p className="bp-sans">ACS data is not available in this environment yet.</p>
        )}
      </section>

      <section className="bp-section" aria-labelledby="hate-crime-heading">
        <p className="bp-section__kicker">FBI Uniform Crime Reporting</p>
        <h2 className="bp-section__title" id="hate-crime-heading">
          Hate crime reporting, {LATEST_HATE_CRIME_YEAR}
        </h2>
        <Notice tone="warning" title="Reporting is voluntary">
          Participation in the UCR hate crime program is voluntary for law enforcement agencies.
          A county with no reported incidents means no participating agency reported one that
          year &mdash; it is a fact about reporting, not a claim that nothing happened. Always
          read these counts beside the national participation rate below.
        </Notice>
        {hateCrimeYear ? (
          <>
            <div className="bp-data-section__viz">
              <HateCrimeCompositionChart summary={hateCrimeYear as HateCrimeYearSummary} />
            </div>
            <ul className="bp-data-strip">
            <DataStatCitation
              value={formatCount((hateCrimeYear as HateCrimeYearSummary).incidents)}
              label={`Reported incidents, ${LATEST_HATE_CRIME_YEAR}`}
              sourceLabel={hateCrimeYear.source}
              sourceUrl={hateCrimeYear.sourceUrl}
            />
            <DataStatCitation
              value={formatCount((hateCrimeYear as HateCrimeYearSummary).antiBlackIncidents)}
              label="Anti-Black or African American bias"
              sourceLabel={hateCrimeYear.source}
              sourceUrl={hateCrimeYear.sourceUrl}
            />
            {hateCrimeYear.nationalParticipatingAgenciesPct !== undefined ? (
              <DataStatCitation
                value={`${hateCrimeYear.nationalParticipatingAgenciesPct}%`}
                label="Agencies participating nationally"
                note="the coverage denominator — read every count above beside this figure"
                sourceLabel={hateCrimeYear.source}
                sourceUrl={hateCrimeYear.sourceUrl}
              />
            ) : null}
            </ul>
          </>
        ) : (
          <p className="bp-sans">FBI hate crime data is not available in this environment yet.</p>
        )}
      </section>

      <section className="bp-section" aria-labelledby="mobility-heading">
        <p className="bp-section__kicker">Opportunity Insights</p>
        <h2 className="bp-section__title" id="mobility-heading">
          Economic mobility by tract
        </h2>
        <p className="bp-section__lede">
          Household income rank in adulthood by race and parental income percentile, from the
          Opportunity Atlas &mdash; tract-level, not a national average (averaging percentile
          ranks across differently sized tracts would itself be a fabricated statistic, so we
          don&rsquo;t publish one here).
        </p>
        {opportunityAtlasCoverage ? (
          <ul className="bp-data-strip">
            <DataStatCitation
              value={formatCount((opportunityAtlasCoverage as OpportunityAtlasCoverageSummary).tractCount)}
              label="Tracts covered (2010 geography)"
              note={opportunityAtlasCoverage.license}
              sourceLabel={opportunityAtlasCoverage.source}
              sourceUrl={opportunityAtlasCoverage.sourceUrl}
            />
          </ul>
        ) : (
          <p className="bp-sans">Opportunity Atlas data is not available in this environment yet.</p>
        )}
      </section>
    </main>
  );
}
