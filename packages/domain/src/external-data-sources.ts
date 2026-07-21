/**
 * External dataset acquisition registry (owner directive 2026-07-18): every third-party
 * dataset BlackStory plans to ingest for the demographics/context modeling layers, recorded
 * BEFORE ingestion with its direct data URL, license verdict, geography, cadence, and (once
 * downloaded) checksum — so each future ingestion session starts from a vetted entry instead
 * of a link dump.
 *
 * Lane boundaries: this is NOT `launch-corpora.ts` (that is the bulk-import vetting lane for
 * entity-bearing corpora; `assertCorpusNotInExcludedLane` would reject several of these) and
 * these are NOT yet `registerSource` registrations (the in-memory registry is for adapters
 * with parser contracts; each ingestion bead builds its full `SourceAdapterContract` when the
 * parser exists). Every entry here starts `registryState: 'disabled'` — recording a source is
 * never approval to ingest it, and license verdicts of `noncommercial`/`unverified` are hard
 * gates requiring rights review before any public surface use.
 *
 * `rightsPolicyForVerdict` projects an entry's license verdict onto the shared
 * `RightsPolicy` vocabulary so future contracts stay consistent with launch-corpora's usage.
 */
import type { RightsPolicy } from './provenance/rights.js';

export const EXTERNAL_SOURCE_LICENSE_VERDICTS = [
  /** U.S. federal government work (17 U.S.C. §105) or equivalent dedication. */
  'public-domain',
  /** Free to use with attribution required (e.g. Eviction Lab). */
  'attribution-required',
  /** Creative Commons NC-class or equivalent — no commercial reuse without review. */
  'noncommercial',
  /** Terms not yet verified — no use until reviewed. */
  'unverified',
] as const;

export type ExternalSourceLicenseVerdict = (typeof EXTERNAL_SOURCE_LICENSE_VERDICTS)[number];

export const EXTERNAL_SOURCE_GEOGRAPHIES = [
  'tract',
  'county',
  'block',
  'blockgroup',
  'address',
  'city',
  'school',
  'facility',
  'state',
  'nation',
] as const;

export type ExternalSourceGeography = (typeof EXTERNAL_SOURCE_GEOGRAPHIES)[number];

export type ExternalDataSource = {
  /** Stable kebab-case id; ingestion adapters use `external-data:<id>`. */
  readonly id: string;
  readonly displayName: string;
  readonly custodian: string;
  readonly homepageUrl: string;
  /** Direct acquisition URL (download hub, API root, or bulk file) — never a marketing page. */
  readonly dataUrl: string;
  readonly license: {
    readonly name: string;
    readonly verdict: ExternalSourceLicenseVerdict;
    readonly notes?: string;
  };
  /** Dataset vintage/version at registration time. */
  readonly vintage: string;
  readonly geographies: readonly ExternalSourceGeography[];
  /** Upstream release cadence (informs refresh scheduling, not a promise to refresh). */
  readonly cadence: 'static' | 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'irregular';
  /** sha256 of the acquired artifact — filled at first successful download. */
  readonly checksumSha256?: string;
  /** Always 'disabled' at registration; ingestion beads move state via the adapter registry. */
  readonly registryState: 'disabled';
  readonly notes: string;
};

export const EXTERNAL_DATA_SOURCES: readonly ExternalDataSource[] = [
  {
    id: 'opportunity-atlas-tract-outcomes',
    displayName: 'Opportunity Atlas tract outcomes (Chetty et al.)',
    custodian: 'Opportunity Insights (Harvard)',
    homepageUrl: 'https://opportunityinsights.org/data/',
    dataUrl:
      'https://opportunityinsightsstatic.s3.us-east-1.amazonaws.com/assets/tract_outcomes_early.csv',
    license: {
      name: 'Opportunity Insights data-use terms (attribution required)',
      verdict: 'attribution-required',
    },
    vintage: 'tract_outcomes_early (2018 release; 2010 tract geography)',
    geographies: ['tract'],
    cadence: 'static',
    checksumSha256: 'ec4d9ee5bcf0282261762f454226e0b7bc5513bc81644583647028da4305d6df',
    registryState: 'disabled',
    notes:
      'Child income rank / incarceration outcomes by race, sex, and parental income percentile. ' +
      '73,278 tracts × 7,897 columns; curated starter subset lives in opportunityAtlasTracts ' +
      '(tractVintage 2010 — crosswalk needed against 2020-tract collections).',
  },
  {
    id: 'mapping-inequality-holc',
    displayName: 'Mapping Inequality: HOLC area polygons + grades',
    custodian: 'University of Richmond Digital Scholarship Lab',
    homepageUrl: 'https://dsl.richmond.edu/panorama/redlining/',
    dataUrl: 'https://dsl.richmond.edu/panorama/redlining/static/mappinginequality.json',
    license: {
      name: 'CC BY-NC-SA 4.0 (DSL vector derivatives); NARA source scans public domain',
      verdict: 'noncommercial',
      notes:
        'Same two-layer reading as launch-corpora.ts mapping-inequality-holc (corrected ' +
        '2026-07-18) — rights review required before revenue-bearing surface use.',
    },
    vintage: '2023 full-download GeoJSON (10,154 areas)',
    geographies: ['city'],
    cadence: 'irregular',
    checksumSha256: '17f3b75e7485b27e48cfe17c93bd234e1ad4b025a24fc0cd0eab00cf812d6ff0',
    registryState: 'disabled',
    notes: 'HOLC residential security grades A–D per neighborhood polygon, 1935–1940 surveys.',
  },
  {
    id: 'fbi-ucr-hate-crime',
    displayName: 'FBI UCR Hate Crime Master File (1991–present)',
    custodian: 'FBI Criminal Justice Information Services (CJIS) Division / UCR Program',
    homepageUrl: 'https://ucr.fbi.gov/hate-crime',
    // The CDE serves bulk files through short-lived signed URLs; this is the stable KEY.
    // Resolve a fresh download URL with:
    //   GET https://cde.ucr.cjis.gov/LATEST/s3/signedurl?key=<this path>
    // Public UI citations use homepageUrl (FBI UCR hate-crime hub), never the signedurl API.
    dataUrl:
      'https://cde.ucr.cjis.gov/LATEST/s3/signedurl?key=additional-datasets/hate-crime/hate_crime.zip',
    license: {
      name: 'U.S. government work — public domain (17 U.S.C. §105)',
      verdict: 'public-domain',
      notes:
        'Cite the FBI UCR Program and the data year; the CDE download is the canonical artifact.',
    },
    vintage: 'hate_crime.csv, data years 1991–2024 (265,834 incidents; released 2025-07-09)',
    geographies: ['county', 'state', 'facility'],
    cadence: 'annual',
    checksumSha256: '6d24e053b340e74e62d0fcf8b237ac470f5ccafc908ba661581f99c2daa9d189',
    registryState: 'disabled',
    notes:
      'Incident-level bias-motivated crime reports. Carries agency ORI + state but NO county — ' +
      'joined to county FIPS via the ucrAgencies crosswalk (FBI agency API + point-in-county). ' +
      'REPORTING IS VOLUNTARY: absence is a fact about reporting, not safety — always read ' +
      'beside reportingAgencyCount and fbi-ucr-participation (see ucr-schema.ts module doc).',
  },
  {
    id: 'fbi-ucr-agency-directory',
    displayName: 'FBI CDE agency directory (ORI → county, coordinates, NIBRS status)',
    custodian: 'FBI Criminal Justice Information Services (CJIS) Division / UCR Program',
    homepageUrl: 'https://cde.ucr.cjis.gov/',
    dataUrl: 'https://cde.ucr.cjis.gov/LATEST/agency/byStateAbbr/{STATE_ABBR}',
    license: {
      name: 'U.S. government work — public domain (17 U.S.C. §105)',
      verdict: 'public-domain',
    },
    vintage: 'live API, retrieved 2026-07-18 (19,415 agencies across 53 states/territories)',
    geographies: ['county', 'facility'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'The reusable ORI join key for EVERY UCR dataset (hate crime, LEOKA, cargo theft, ' +
      'human trafficking — all in the same CDE downloads manifest). Fetched per state; ' +
      'county assignment resolved by FBI county name where unambiguous, else point-in-county ' +
      'on the agency coordinates (98.6% of agencies resolve).',
  },
  {
    id: 'fbi-ucr-participation',
    displayName: 'FBI UCR Program participation (1960–2024)',
    custodian: 'FBI Criminal Justice Information Services (CJIS) Division / UCR Program',
    homepageUrl: 'https://ucr.fbi.gov/hate-crime',
    dataUrl:
      'https://cde.ucr.cjis.gov/LATEST/s3/signedurl?key=additional-datasets/ucr/ucr_participation_1960_2024.csv',
    license: {
      name: 'U.S. government work — public domain (17 U.S.C. §105)',
      verdict: 'public-domain',
    },
    vintage: 'ucr_participation_1960_2024.csv (state-year coverage)',
    geographies: ['state'],
    cadence: 'annual',
    checksumSha256: 'a0a1a5ea2c31f2b530672c85a4ad1787b4a2abf196b3681b1b23c366002cfab0',
    registryState: 'disabled',
    notes:
      'The coverage denominator that makes every other UCR count interpretable — required ' +
      'reading beside hate crime totals so a silent state is never mistaken for a safe one.',
  },
  {
    id: 'hmda-loan-level',
    displayName: 'HMDA mortgage records (loan-level)',
    custodian: 'Consumer Financial Protection Bureau (CFPB)',
    homepageUrl: 'https://ffiec.cfpb.gov/data-browser/',
    dataUrl: 'https://ffiec.cfpb.gov/data-publication/snapshot-national-loan-level-dataset',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'annual snapshots 2017–2024; historic archives to 2007',
    geographies: ['tract', 'county'],
    cadence: 'annual',
    registryState: 'disabled',
    notes:
      'Mortgage application/origination/denial by race, income, tract. Snapshot files are the ' +
      'reproducible modeling input; dynamic files churn weekly.',
  },
  {
    id: 'hud-chas',
    displayName: 'HUD Comprehensive Housing Affordability Strategy (CHAS)',
    custodian: 'U.S. Department of Housing and Urban Development',
    homepageUrl: 'https://www.huduser.gov/portal/datasets/cp.html',
    dataUrl: 'https://www.huduser.gov/portal/datasets/cp.html#data_2006-2023',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'ACS-based 5-year tabulations (latest 2017–2021+)',
    geographies: ['tract', 'county', 'state'],
    cadence: 'annual',
    registryState: 'disabled',
    notes: 'Housing cost burden, severe burden, overcrowding, tenure by income and race.',
  },
  {
    id: 'crdc-school-civil-rights',
    displayName: 'Civil Rights Data Collection (CRDC)',
    custodian: 'U.S. Department of Education, Office for Civil Rights',
    homepageUrl: 'https://civilrightsdata.ed.gov/',
    dataUrl: 'https://civilrightsdata.ed.gov/data',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'biennial collections; stable ZIPs for 2013–14/2015–16/2017–18, newer on data page',
    geographies: ['school'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'School discipline, arrests, restraint/seclusion, course access, staffing by race — ' +
      'joins to districts via NCES ids (districts.json national-catalog entities).',
  },
  {
    id: 'seda-education-archive',
    displayName: 'Stanford Education Data Archive (SEDA)',
    custodian: 'Stanford CEPA / Educational Opportunity Project',
    homepageUrl: 'https://edopportunity.org/',
    dataUrl: 'https://edopportunity.org/get-the-data/seda-archive-downloads/',
    license: {
      name: 'CC BY-NC 4.0 + data-use agreement',
      verdict: 'noncommercial',
      notes: 'Download requires agreement acceptance; rights review before public surface use.',
    },
    vintage: 'SEDA 2023 (5.0)',
    geographies: ['county', 'school'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes: 'Achievement, learning rates, and gaps by district/county, race, and income.',
  },
  {
    id: 'cdc-places',
    displayName: 'CDC PLACES local health estimates',
    custodian: 'Centers for Disease Control and Prevention',
    homepageUrl: 'https://www.cdc.gov/places/',
    dataUrl: 'https://data.cdc.gov/browse?category=500+Cities+%26+Places',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'annual releases (2024/2025), tract + county + place + ZCTA',
    geographies: ['tract', 'county', 'city'],
    cadence: 'annual',
    registryState: 'disabled',
    notes: 'Modeled prevalence for ~40 health measures; Socrata API + bulk CSV.',
  },
  {
    id: 'sundown-towns-osf',
    displayName: 'Sundown-town dataset (academic, Census-matched)',
    custodian: 'OSF-archived replication of Loewen/History & Social Justice data (Tougaloo)',
    homepageUrl: 'https://justice.tougaloo.edu/sundown-towns/',
    dataUrl: 'https://osf.io/',
    license: {
      name: 'Tougaloo History & Social Justice project terms — unverified',
      verdict: 'unverified',
      notes:
        'Confidence labels (possible/probable/surely) must be preserved per ' +
        'historic-safety/source-registry.ts; excluded from launch-corpora by lane rule.',
    },
    vintage: '1940–2020 Census-geography-matched release (Scientific Data 2024)',
    geographies: ['city'],
    cadence: 'static',
    registryState: 'disabled',
    notes:
      'Handled by the exclusion-infrastructure lane () with dignity rules; registry entry ' +
      'here records acquisition metadata only.',
  },
  {
    id: 'lehd-lodes',
    displayName: 'LEHD Origin-Destination Employment Statistics (LODES)',
    custodian: 'U.S. Census Bureau LEHD',
    homepageUrl: 'https://lehd.ces.census.gov/data/',
    dataUrl: 'https://lehd.ces.census.gov/data/lodes/LODES8/',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'LODES8 (2020 block geography), annual back to 2002',
    geographies: ['block'],
    cadence: 'annual',
    registryState: 'disabled',
    notes: 'Block-level workplace/residence/origin-destination employment flows.',
  },
  {
    id: 'eviction-lab',
    displayName: 'Eviction Lab tracking data',
    custodian: 'Eviction Lab (Princeton)',
    homepageUrl: 'https://evictionlab.org/',
    dataUrl: 'https://evictionlab.org/get-the-data/',
    license: {
      name: 'Eviction Lab data-use terms — attribution required',
      verdict: 'attribution-required',
    },
    vintage: 'Eviction Tracking System (2020+) + national 2000–2018 dataset',
    geographies: ['tract', 'county', 'city'],
    cadence: 'monthly',
    registryState: 'disabled',
    notes: 'Filing/judgment trends where court coverage exists; coverage is partial by design.',
  },
  {
    id: 'usda-food-access',
    displayName: 'USDA Food Access Research Atlas',
    custodian: 'USDA Economic Research Service',
    homepageUrl: 'https://www.ers.usda.gov/data-products/food-access-research-atlas/',
    dataUrl: 'https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data/',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: '2019 atlas (2010 tract geography)',
    geographies: ['tract'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes: 'Supermarket access, vehicle access, low-income/low-access flags per tract.',
  },
  {
    id: 'cdc-svi',
    displayName: 'CDC/ATSDR Social Vulnerability Index (SVI)',
    custodian: 'CDC / ATSDR',
    homepageUrl: 'https://www.atsdr.cdc.gov/placeandhealth/svi/index.html',
    dataUrl: 'https://www.atsdr.cdc.gov/placeandhealth/svi/data_documentation_download.html',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'SVI 2022 (biennial)',
    geographies: ['tract', 'county'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes: 'Four vulnerability themes + composite from ACS variables.',
  },
  {
    id: 'cdc-eji',
    displayName: 'CDC Environmental Justice Index (EJI)',
    custodian: 'CDC / ATSDR',
    homepageUrl: 'https://www.atsdr.cdc.gov/placeandhealth/eji/index.html',
    dataUrl: 'https://www.atsdr.cdc.gov/placeandhealth/eji/eji-data-download.html',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'EJI 2024',
    geographies: ['tract'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes: 'Environmental burden + health vulnerability + socioeconomic context ranks.',
  },
  {
    id: 'epa-tri',
    displayName: 'EPA Toxics Release Inventory (TRI) basic data files',
    custodian: 'U.S. Environmental Protection Agency',
    homepageUrl: 'https://www.epa.gov/toxics-release-inventory-tri-program',
    dataUrl:
      'https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'annual, 1987–present',
    geographies: ['facility'],
    cadence: 'annual',
    registryState: 'disabled',
    notes: 'Facility-level reported toxic releases; geocoded, joinable to tracts by point.',
  },
  {
    id: 'epa-superfund-npl',
    displayName: 'EPA Superfund National Priorities List site boundaries',
    custodian: 'U.S. Environmental Protection Agency',
    homepageUrl: 'https://www.epa.gov/superfund',
    dataUrl:
      'https://catalog.data.gov/dataset/superfund-national-priorities-list-npl-site-boundaries',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'current NPL boundary release',
    geographies: ['facility'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes: 'Polygon overlap/proximity to documented contamination sites.',
  },
  {
    id: 'fema-nri',
    displayName: 'FEMA National Risk Index',
    custodian: 'Federal Emergency Management Agency',
    homepageUrl: 'https://hazards.fema.gov/nri/',
    dataUrl: 'https://hazards.fema.gov/nri/data-resources',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'NRI 2023 release',
    geographies: ['tract', 'county'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes: 'Natural-hazard expected loss, social vulnerability, community resilience.',
  },
  {
    id: 'census-abs',
    displayName: 'Annual Business Survey (ABS) — employer businesses by owner demographics',
    custodian: 'U.S. Census Bureau',
    homepageUrl: 'https://www.census.gov/programs-surveys/abs.html',
    dataUrl: 'https://api.census.gov/data/2023/abscb',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'abscb/abscbo vintages 2017–2023 (api.census.gov)',
    geographies: ['county', 'state'],
    cadence: 'annual',
    registryState: 'disabled',
    notes:
      'Black-owned employer business counts/receipts — same census-demographics adapter ' +
      'family and CENSUS_API_KEY as the ACS pulls.',
  },
  {
    id: 'census-nesd',
    displayName: 'Nonemployer Statistics by Demographics (NES-D)',
    custodian: 'U.S. Census Bureau',
    homepageUrl: 'https://www.census.gov/programs-surveys/abs/data/nesd.html',
    dataUrl: 'https://api.census.gov/data/2023/absnesd',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'absnesd/absnesdo vintages 2018–2023 (api.census.gov)',
    geographies: ['county', 'state'],
    cadence: 'annual',
    registryState: 'disabled',
    notes: 'Black-owned nonemployer business counts and receipts.',
  },
  {
    id: 'us-census-historical-race-1790-1990',
    displayName: 'Historical Census Statistics on Population Totals by Race, 1790–1990 (twps0056)',
    custodian: 'U.S. Census Bureau, Population Division',
    homepageUrl: 'https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html',
    // Machine artifact: Table 1 (United States national totals by race, 1790–1990) as .xlsx.
    dataUrl: 'https://www2.census.gov/library/working-papers/2002/demo/pop-twps0056/table01.xlsx',
    license: {
      name: 'U.S. government work — public domain (17 U.S.C. §105)',
      verdict: 'public-domain',
      notes:
        'Gibson & Jung, Population Division Working Paper No. 56 (Sept 2002). Free for all uses. ' +
        'Public citations must point at the working-paper landing page (homepageUrl), never the ' +
        'raw table01.xlsx machine URL.',
    },
    vintage:
      'Working Paper 56 — national Table 1 + state Tables 15–65 (Internet release 2002-09-13)',
    geographies: ['nation', 'state'],
    cadence: 'static',
    notes:
      'National Total/White/Black population by decade 1790–1990 (Table 1), with the Black column ' +
      'split into Free/Slave for 1790–1860, plus per-state Tables 15–65 loaded into ' +
      'censusStateDecades. Public-domain historical enumerations — the 1790–1990 lane of the ' +
      'national/state timelines (2000–2020 comes from censusCountyDecades sums). Race labels are ' +
      'twps0056-harmonized ("Black"); comparability bands in demographics/comparability.ts record ' +
      'the period terminology ("Negro"/"colored") and the pre-2000 vs "Black alone" ' +
      'measurement-regime boundary. Machine artifacts: table01.xlsx (national), tabs15-65.xlsx (states).',
    registryState: 'disabled',
  },
  {
    id: 'nhgis-county-race',
    displayName: 'IPUMS NHGIS county race / Black population time series',
    custodian: 'IPUMS NHGIS (University of Minnesota)',
    homepageUrl: 'https://www.nhgis.org/',
    dataUrl: 'https://api.ipums.org/',
    license: {
      name: 'Free for registered IPUMS users — IPUMS terms of use (attribution required)',
      verdict: 'attribution-required',
      notes:
        'Registration and NHGIS_API_KEY required; no automated ingest until human gate clears.',
    },
    vintage: 'Historical decennial county race tables 1790–2020 (NHGIS time series + crosswalks)',
    geographies: ['county', 'state'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'Historical decennial 1790–2020 county race counts for pre-2000 decades and boundary-stable ' +
      'Δ via NHGIS time-series tables + crosswalks. Blocked on human NHGIS_API_KEY registration — ' +
      'see packages/domain/src/adapters/nhgis/ scaffold and demographics/comparability.ts for ' +
      'category comparability notes (do not invent harmonized totals).',
  },
  {
    id: 'slavevoyages-transatlantic',
    displayName: 'SlaveVoyages — Trans-Atlantic Slave Trade Database',
    custodian: 'SlaveVoyages Consortium (Rice University et al.)',
    homepageUrl: 'https://www.slavevoyages.org/voyage/about/',
    dataUrl: 'https://www.slavevoyages.org/voyage/downloads',
    license: {
      name: 'CC BY-NC 3.0 US (imputed values); observed/documented values in the public domain',
      verdict: 'noncommercial',
      notes:
        'Attribution required; commercial use of imputed (asterisked) values prohibited without ' +
        'written permission from the SlaveVoyages Consortium. Public display is GATED on a rights ' +
        'review that includes an owner determination of whether BlackStory is "commercial" — same ' +
        'closed lane as mapping-inequality-holc / seda-education-archive. Do not ingest or surface ' +
        'until that review clears (repo-lcl9.4).',
    },
    vintage: 'Trans-Atlantic Slave Trade Database v2024-11 (~36,000 voyages, 1514–1866)',
    // A forced-migration FLOW by Atlantic macro-region (embark/disembark), NOT a U.S. resident
    // geography; 'nation' is the closest vocab token for the mainland-North-America disembarkation
    // slice. This is never resident population.
    geographies: ['nation'],
    cadence: 'irregular',
    notes:
      'Forced-arrival FLOW series ONLY — captives embarked (obs. TSLAVESD / imp. SLAXIMP) and ' +
      'disembarked (obs. SLAARRIV / imp. SLAMIMP) by year and Atlantic region, 1514–1866; mainland ' +
      'North America is filterable (<4% of voyages). MUST stay a separate flow series with its own ' +
      'vocabulary and visualization — never converted into or shown as resident Black population ' +
      'without a peer-reviewed demographic model. Preserve the observed-vs-imputed distinction. ' +
      'Deferred acquisition/modeling tracked on repo-lcl9.4.',
    registryState: 'disabled',
  },
  {
    id: 'fcc-broadband-map',
    displayName: 'FCC National Broadband Map (BDC)',
    custodian: 'Federal Communications Commission',
    homepageUrl: 'https://broadbandmap.fcc.gov/',
    dataUrl: 'https://broadbandmap.fcc.gov/data-download',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'biannual BDC filings (latest release)',
    geographies: ['address', 'blockgroup'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes: 'Fixed/mobile availability, technology, advertised speeds per location.',
  },
  {
    id: 'bjs-national-prisoner-statistics',
    displayName: 'National Prisoner Statistics (NPS) — custody counts by jurisdiction and race',
    custodian: 'U.S. Bureau of Justice Statistics (BJS) / ICPSR NACJD',
    homepageUrl: 'https://bjs.ojp.gov/data-collection/nps',
    dataUrl: 'https://www.icpsr.umich.edu/web/NACJD/studies/38871',
    license: {
      name: 'U.S. government work via ICPSR public-use files — public domain / ICPSR terms',
      verdict: 'public-domain',
      notes:
        'Prefer BJS published tables and ICPSR public-use NPS files. Restricted microdata stays cite-only.',
    },
    vintage: 'NPS series through latest ICPSR release (e.g. 1978–2022 study 38871)',
    geographies: ['state', 'nation'],
    cadence: 'annual',
    registryState: 'disabled',
    notes:
      'Canonical state/federal imprisonment enumeration. Store annual custody counts and rates by ' +
      'race where BJS publishes them as StatisticalSeries — not person-level records. Phase 1 MVP ' +
      'metric ids: imprisonment-rate-black-state, imprisonment-rate-white-state (see ' +
      'phase1-indicator-catalog.ts).',
  },
  {
    id: 'vera-incarceration-trends',
    displayName: 'Vera Incarceration Trends — county and state jail/prison estimates',
    custodian: 'Vera Institute of Justice',
    homepageUrl: 'https://www.vera.org/projects/incarceration-trends',
    dataUrl: 'https://github.com/vera-institute/incarceration-trends',
    license: {
      name: 'Vera data-use / GitHub terms — attribution required (verify per release README)',
      verdict: 'attribution-required',
    },
    vintage: 'Incarceration Trends compiled releases (county/state time series)',
    geographies: ['county', 'state'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'Place-indexed incarceration trends for research context panels. Prefer Vera compiled ' +
      'county/state rates over raw NCRP for Phase 1; keep method notes on every observation. ' +
      'Not a substitute for BJS NPS as the federal enumeration SoT.',
  },
  {
    id: 'bjs-annual-survey-of-jails',
    displayName: 'Annual Survey of Jails / Jail Inmates (BJS)',
    custodian: 'U.S. Bureau of Justice Statistics',
    homepageUrl: 'https://bjs.ojp.gov/data-collection/asj',
    dataUrl: 'https://bjs.ojp.gov/data/data-tables-and-data-files',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'ASJ / Jail Inmates latest annual tables',
    geographies: ['state', 'facility'],
    cadence: 'annual',
    registryState: 'disabled',
    notes:
      'Local jail confinement distinct from state/federal prison. Store jurisdiction aggregates ' +
      'only; facility-level stays research-closed until dignity review.',
  },
  {
    id: 'bjs-ncrp-public-use',
    displayName: 'National Corrections Reporting Program (NCRP) — public-use selected variables',
    custodian: 'U.S. Bureau of Justice Statistics / ICPSR NACJD',
    homepageUrl: 'https://bjs.ojp.gov/data-collection/ncrp',
    dataUrl: 'https://www.icpsr.umich.edu/web/NACJD/studies/38492',
    license: {
      name: 'ICPSR public-use terms; restricted files require ResearchDataGov',
      verdict: 'attribution-required',
      notes: 'Do not ingest full person-level files into product SoR — cite/proxy or derive aggregates.',
    },
    vintage: 'NCRP public-use selected variables (ICPSR releases)',
    geographies: ['state', 'facility'],
    cadence: 'annual',
    registryState: 'disabled',
    notes:
      'Person-level admissions/releases — too large for full SoR. Strategy: cite ICPSR DOI; store ' +
      'only derived state×year×race tables if an ingestion bead produces them with provenance.',
  },
  {
    id: 'fed-survey-consumer-finances',
    displayName: 'Survey of Consumer Finances (SCF) — wealth by race of family',
    custodian: 'Board of Governors of the Federal Reserve System',
    homepageUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
    dataUrl: 'https://www.federalreserve.gov/econres/scfindex.htm',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'Triennial SCF (latest public microdata + bulletin tables)',
    geographies: ['nation'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'Gold-standard national wealth gap by race. Store national median/mean net worth series only; ' +
      'full microdata is cite/proxy. Never invent county wealth from SCF.',
  },
  {
    id: 'census-sipp-wealth',
    displayName: 'Survey of Income and Program Participation (SIPP) — household wealth',
    custodian: 'U.S. Census Bureau',
    homepageUrl: 'https://www.census.gov/programs-surveys/sipp.html',
    dataUrl: 'https://www.census.gov/programs-surveys/sipp/data/datasets.html',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'SIPP public-use wealth briefs / panels (e.g. 2021–2023 wealth publications)',
    geographies: ['nation'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'Complements SCF for national Black–White wealth framing. Prefer published Census briefs for ' +
      'Phase 1 national series; microdata cite-only.',
  },
  {
    id: 'bls-laus-unemployment',
    displayName: 'Local Area Unemployment Statistics (LAUS) / CPS unemployment',
    custodian: 'U.S. Bureau of Labor Statistics',
    homepageUrl: 'https://www.bls.gov/lau/',
    dataUrl: 'https://www.bls.gov/lau/data.htm',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'LAUS monthly/annual; CPS race slices where published',
    geographies: ['state', 'city'],
    cadence: 'monthly',
    registryState: 'disabled',
    notes:
      'Labor market context. Store state/metro series; race slices only where BLS publishes them — ' +
      'do not impute race-specific LAUS at county.',
  },
  {
    id: 'mit-election-lab',
    displayName: 'MIT Election Data and Science Lab — election results and admin data',
    custodian: 'MIT Election Data + Science Lab',
    homepageUrl: 'https://electionlab.mit.edu/',
    dataUrl: 'https://electionlab.mit.edu/data',
    license: {
      name: 'Academic / project terms — attribution required (verify per dataset)',
      verdict: 'attribution-required',
    },
    vintage: 'Election Lab curated releases',
    geographies: ['state', 'county'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'Voting / election-administration context for franchise research. Selective store of ' +
      'state/county indicators; not a voter file.',
  },
  {
    id: 'voting-rights-lab-indicators',
    displayName: 'Voting Rights Lab — state election policy / voting rights indicators',
    custodian: 'Voting Rights Lab',
    homepageUrl: 'https://votingrightslab.org/',
    dataUrl: 'https://votingrightslab.org/',
    license: {
      name: 'NGO terms — verify before ingest; default attribution-required',
      verdict: 'attribution-required',
      notes: 'Confirm redistribution rights before any bulk load; cite portal when unverified for reuse.',
    },
    vintage: 'State policy tracker releases',
    geographies: ['state'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'Franchise and election-admin policy indicators for juxtaposition with law entities. Prefer ' +
      'cite until redistribution terms are recorded on checksum acquisition.',
  },
  {
    id: 'stanford-open-policing',
    displayName: 'Stanford Open Policing Project — traffic stop aggregates',
    custodian: 'Stanford Computational Policy Lab / Open Policing Project',
    homepageUrl: 'https://openpolicing.stanford.edu/',
    dataUrl: 'https://openpolicing.stanford.edu/data/',
    license: {
      name: 'Project terms — attribution; high sensitivity',
      verdict: 'attribution-required',
    },
    vintage: 'Open Policing multi-agency releases',
    geographies: ['city', 'facility'],
    cadence: 'irregular',
    registryState: 'disabled',
    notes:
      'Traffic-stop disparity research. Cite and store agency-level aggregates only after dignity ' +
      'review — never individual stops; never crime-heat map rendering.',
  },
  {
    id: 'pen-america-school-book-bans',
    displayName: 'PEN America Index of School Book Bans',
    custodian: 'PEN America',
    homepageUrl: 'https://pen.org/book-bans/',
    dataUrl: 'https://pen.org/book-bans/pen-america-book-ban-index-data/',
    license: {
      name: 'PEN America terms — rights review required before bulk redistribute',
      verdict: 'attribution-required',
      notes:
        'Public index and reports may be cited by URL. Bulk CSV/spreadsheet ingest is DISABLED until human rights review clears redistribution for product use. Curated BlackStory listing cites public pages; does not mirror the full PEN dataset.',
    },
    vintage: '2024-2025 Index (and prior school-year indices)',
    geographies: ['state'],
    cadence: 'annual',
    registryState: 'disabled',
    notes:
      'Primary research pointer for U.S. school book bans. Wire bulk refresh only after license gate. Quarterly job validates curated seed + purchase links only.',
  },
] as const;

export function getExternalDataSource(id: string): ExternalDataSource | undefined {
  return EXTERNAL_DATA_SOURCES.find((source) => source.id === id);
}

/** Projects a license verdict onto the shared RightsPolicy vocabulary — keeps future
 * `SourceAdapterContract.rights` consistent with launch-corpora's policies. */
export function rightsPolicyForVerdict(verdict: ExternalSourceLicenseVerdict): RightsPolicy {
  switch (verdict) {
    case 'public-domain':
      return {
        defaultStatus: 'public_domain',
        publicationPermissions: ['cite', 'short_excerpt', 'substantial_excerpt'],
        prohibitedUses: ['biometric_extraction'],
      };
    case 'attribution-required':
      return {
        defaultStatus: 'licensed',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse'],
      };
    case 'noncommercial':
      return {
        defaultStatus: 'licensed',
        publicationPermissions: ['cite', 'short_excerpt'],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse', 'commercial_reuse'],
      };
    case 'unverified':
      return {
        defaultStatus: 'unknown',
        publicationPermissions: [],
        prohibitedUses: ['full_text_republication', 'unattributed_reuse', 'commercial_reuse'],
      };
  }
}
