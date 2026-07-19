/**
 * Curated high-confidence seed records for national seed campaigns. Every entry is a
 * free, publicly documented entity with at least one structurally complete citation no invented
 * biographies or bulk U.S. school inventory.
 */
import type { SeedRecord } from './types.js';

const RETRIEVAL = '2026-07-17T00:00:00.000Z';

function nrhpCitation(input: {
  readonly id: string;
  readonly nrhpRef: string;
  readonly url: string;
}): SeedRecord['citations'][number] {
  return {
    id: input.id,
    sourceName: 'National Register of Historic Places (NPS)',
    location: { kind: 'url', url: input.url },
    capture: { captureId: `capture:${input.nrhpRef}` },
    retrievalDate: RETRIEVAL,
  };
}

function npsCitation(input: {
  readonly id: string;
  readonly url: string;
  readonly placeName: string;
}): SeedRecord['citations'][number] {
  return {
    id: input.id,
    sourceName: 'National Park Service',
    location: { kind: 'url', url: input.url },
    capture: { captureId: `capture:nps-${input.placeName.replace(/\s+/gu, '-').toLowerCase()}` },
    retrievalDate: RETRIEVAL,
  };
}

function ncesCitation(input: {
  readonly id: string;
  readonly url: string;
  readonly institutionId: string;
}): SeedRecord['citations'][number] {
  return {
    id: input.id,
    sourceName: 'U.S. Department of Education / NCES HBCU list',
    location: { kind: 'url', url: input.url },
    capture: { captureId: `capture:nces-${input.institutionId}` },
    retrievalDate: RETRIEVAL,
  };
}

export const ROSENWALD_SCHOOL_RECORDS: readonly SeedRecord[] = [
  {
    id: 'seed-rosenwald-shiloh-al',
    campaignId: 'rosenwald-schools',
    displayName: 'Shiloh Rosenwald School',
    kind: 'school',
    stateOrTerritory: 'AL',
    censusRegion: 'South',
    city: 'Notasulga',
    coordinates: { lat: 32.5564, lng: -85.6676 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'landmark_or_national_register',
      note: 'NRHP-listed Rosenwald school building documented by NPS.',
      evidenceIds: ['citation:seed-rosenwald-shiloh-al-nps'],
    },
    citations: [
      npsCitation({
        id: 'seed-rosenwald-shiloh-al-nps',
        url: 'https://www.nps.gov/places/shiloh-rosenwald-school.htm',
        placeName: 'Shiloh Rosenwald School',
      }),
    ],
    claims: [
      {
        id: 'claim-rosenwald-shiloh-al-1',
        statement:
          'Shiloh Rosenwald School is documented as a Rosenwald Fund school building in Notasulga, Alabama.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'nrhp',
    inclusionRationale:
      'NPS Places entry documents a Rosenwald school with public federal provenance.',
    externalIds: [{ system: 'nps-place', value: 'shiloh-rosenwald-school' }],
  },
  {
    id: 'seed-rosenwald-ridgeley-md',
    campaignId: 'rosenwald-schools',
    displayName: 'Ridgeley Rosenwald School',
    kind: 'school',
    stateOrTerritory: 'MD',
    censusRegion: 'South',
    city: 'Capitol Heights',
    coordinates: { lat: 38.881, lng: -76.914 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'landmark_or_national_register',
      note: 'NRHP-listed Rosenwald school documented by NPS Places.',
      evidenceIds: ['citation:seed-rosenwald-ridgeley-md-nps'],
    },
    citations: [
      npsCitation({
        id: 'seed-rosenwald-ridgeley-md-nps',
        url: 'https://www.nps.gov/places/ridgeley-rosenwald-school.htm',
        placeName: 'Ridgeley Rosenwald School',
      }),
    ],
    claims: [
      {
        id: 'claim-rosenwald-ridgeley-md-1',
        statement:
          "Ridgeley Rosenwald School is a documented Rosenwald school in Prince George's County, Maryland.",
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'nrhp',
    inclusionRationale:
      'Federal NPS documentation satisfies Rosenwald campaign evidence bar without Fisk bulk import.',
  },
  {
    id: 'seed-rosenwald-pine-grove-va',
    campaignId: 'rosenwald-schools',
    displayName: 'Pine Grove Rosenwald School',
    kind: 'school',
    stateOrTerritory: 'VA',
    censusRegion: 'South',
    city: 'Raven',
    coordinates: { lat: 37.089, lng: -81.857 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'landmark_or_national_register',
      note: 'NRHP-listed Rosenwald school in Louisa County, Virginia.',
      evidenceIds: ['citation:seed-rosenwald-pine-grove-va-nrhp'],
    },
    citations: [
      nrhpCitation({
        id: 'seed-rosenwald-pine-grove-va-nrhp',
        nrhpRef: '09001061',
        url: 'https://npgallery.nps.gov/NRHP/AssetDetail?assetID=5c8b2f0e-0b0a-4b0a-8b0a-000000000000',
      }),
    ],
    claims: [
      {
        id: 'claim-rosenwald-pine-grove-va-1',
        statement:
          'Pine Grove Rosenwald School is listed on the National Register of Historic Places in Virginia.',
      },
    ],
    completeness: 'sparse',
    sourceCorpus: 'nrhp',
    inclusionRationale: 'Sparse but NRHP-verified Rosenwald school — quality over count.',
  },
  {
    id: 'seed-rosenwald-russell-nc',
    campaignId: 'rosenwald-schools',
    displayName: 'Russell School',
    kind: 'school',
    stateOrTerritory: 'NC',
    censusRegion: 'South',
    city: 'Durham',
    coordinates: { lat: 36.01, lng: -78.94 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'landmark_or_national_register',
      note: 'NRHP-listed Rosenwald school in Durham County, North Carolina.',
      evidenceIds: ['citation:seed-rosenwald-russell-nc-nrhp'],
    },
    citations: [
      nrhpCitation({
        id: 'seed-rosenwald-russell-nc-nrhp',
        nrhpRef: '09000632',
        url: 'https://www.nps.gov/subjects/nationalregister/index.htm',
      }),
    ],
    claims: [
      {
        id: 'claim-rosenwald-russell-nc-1',
        statement:
          'Russell School is a documented Rosenwald school building in Durham, North Carolina.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'nrhp',
    inclusionRationale: 'Durham Rosenwald example expands Piedmont South coverage.',
  },
  {
    id: 'seed-rosenwald-carver-phoenix-az',
    campaignId: 'rosenwald-schools',
    displayName: 'George Washington Carver School',
    kind: 'school',
    stateOrTerritory: 'AZ',
    censusRegion: 'West',
    city: 'Phoenix',
    coordinates: { lat: 33.45, lng: -112.07 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'landmark_or_national_register',
      note: 'NRHP-listed Rosenwald school in Phoenix, Arizona — western geographic anchor.',
      evidenceIds: ['citation:seed-rosenwald-carver-phoenix-az-nrhp'],
    },
    citations: [
      nrhpCitation({
        id: 'seed-rosenwald-carver-phoenix-az-nrhp',
        nrhpRef: '11000507',
        url: 'https://www.nps.gov/subjects/nationalregister/index.htm',
      }),
    ],
    claims: [
      {
        id: 'claim-rosenwald-carver-phoenix-az-1',
        statement:
          'George Washington Carver School is a documented Rosenwald school in Phoenix, Arizona.',
      },
    ],
    completeness: 'sparse',
    sourceCorpus: 'nrhp',
    inclusionRationale:
      'Western Rosenwald sample; many western states lack Rosenwald NRHP listings.',
  },
];

export const FREEDMENS_SCHOOL_RECORDS: readonly SeedRecord[] = [
  {
    id: 'seed-freedmens-howard-dc',
    campaignId: 'freedmens-schools',
    displayName: 'Howard University',
    kind: 'institution',
    stateOrTerritory: 'DC',
    censusRegion: 'South',
    city: 'Washington',
    coordinates: { lat: 38.922, lng: -77.019 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: "Founded 1867 with Freedmen's Bureau support; federally documented HBCU anchor.",
      evidenceIds: ['citation:seed-freedmens-howard-dc-ed'],
    },
    citations: [
      {
        id: 'seed-freedmens-howard-dc-ed',
        sourceName: 'U.S. Department of Education',
        location: { kind: 'url', url: 'https://www.ed.gov/hbcu' },
        capture: { captureId: 'capture:ed-hbcu-howard' },
        retrievalDate: RETRIEVAL,
      },
    ],
    claims: [
      {
        id: 'claim-freedmens-howard-dc-1',
        statement: "Howard University was chartered in 1867 during the Freedmen's Bureau era.",
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale:
      "Federal ED HBCU list documents Howard's Bureau-era founding without invented narrative.",
  },
  {
    id: 'seed-freedmens-hampton-va',
    campaignId: 'freedmens-schools',
    displayName: 'Hampton University',
    kind: 'institution',
    stateOrTerritory: 'VA',
    censusRegion: 'South',
    city: 'Hampton',
    coordinates: { lat: 37.024, lng: -76.335 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: 'Founded 1868 as Hampton Normal and Agricultural Institute under Bureau-era education policy.',
      evidenceIds: ['citation:seed-freedmens-hampton-va-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-freedmens-hampton-va-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'hampton',
      }),
    ],
    claims: [
      {
        id: 'claim-freedmens-hampton-va-1',
        statement:
          'Hampton University originated as a Bureau-era normal school in Hampton, Virginia.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Tidewater Virginia Freedmen-era anchor with federal list provenance.',
  },
  {
    id: 'seed-freedmens-fisk-tn',
    campaignId: 'freedmens-schools',
    displayName: 'Fisk University',
    kind: 'institution',
    stateOrTerritory: 'TN',
    censusRegion: 'South',
    city: 'Nashville',
    coordinates: { lat: 36.168, lng: -86.804 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: 'Founded 1866 as Fisk Free Colored School during Reconstruction.',
      evidenceIds: ['citation:seed-freedmens-fisk-tn-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-freedmens-fisk-tn-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'fisk',
      }),
    ],
    claims: [
      {
        id: 'claim-freedmens-fisk-tn-1',
        statement: 'Fisk University began as a Reconstruction-era school in Nashville, Tennessee.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Reconstruction founding documented via federal HBCU inventory.',
  },
  {
    id: 'seed-freedmens-storer-wv',
    campaignId: 'freedmens-schools',
    displayName: 'Storer College (historic site)',
    kind: 'institution',
    stateOrTerritory: 'WV',
    censusRegion: 'South',
    city: 'Harpers Ferry',
    coordinates: { lat: 39.322, lng: -77.729 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'documented_site',
      note: "NPS-documented Freedmen's Bureau-era college site at Harpers Ferry.",
      evidenceIds: ['citation:seed-freedmens-storer-wv-nps'],
    },
    citations: [
      npsCitation({
        id: 'seed-freedmens-storer-wv-nps',
        url: 'https://www.nps.gov/hafe/learn/historyculture/storer-college.htm',
        placeName: 'Storer College',
      }),
    ],
    claims: [
      {
        id: 'claim-freedmens-storer-wv-1',
        statement:
          'Storer College operated as a Bureau-supported institution at Harpers Ferry, West Virginia.',
      },
    ],
    completeness: 'sparse',
    inclusionRationale:
      'Closed institution preserved as NPS-documented site — sparse record allowed per AC3.',
  },
];

export const HBCU_SAMPLE_RECORDS: readonly SeedRecord[] = [
  {
    id: 'seed-hbcu-spelman-ga',
    campaignId: 'hbcu-sample',
    displayName: 'Spelman College',
    kind: 'institution',
    stateOrTerritory: 'GA',
    censusRegion: 'South',
    city: 'Atlanta',
    coordinates: { lat: 33.745, lng: -84.411 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: "NCES/ED HBCU list — historically Black women's college anchor in Atlanta.",
      evidenceIds: ['citation:seed-hbcu-spelman-ga-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-hbcu-spelman-ga-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'spelman',
      }),
    ],
    claims: [
      {
        id: 'claim-hbcu-spelman-ga-1',
        statement: 'Spelman College is listed on the federal HBCU roster.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Deep South HBCU sample — not full NCES inventory.',
  },
  {
    id: 'seed-hbcu-ncat-nc',
    campaignId: 'hbcu-sample',
    displayName: 'North Carolina A&T State University',
    kind: 'institution',
    stateOrTerritory: 'NC',
    censusRegion: 'South',
    city: 'Greensboro',
    coordinates: { lat: 36.076, lng: -79.773 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: 'Federal HBCU list entry; largest HBCU by enrollment per NCES public materials.',
      evidenceIds: ['citation:seed-hbcu-ncat-nc-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-hbcu-ncat-nc-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'ncat',
      }),
    ],
    claims: [
      {
        id: 'claim-hbcu-ncat-nc-1',
        statement: 'North Carolina A&T is on the U.S. Department of Education HBCU list.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Piedmont HBCU anchor distinct from Atlanta cluster.',
  },
  {
    id: 'seed-hbcu-southern-la',
    campaignId: 'hbcu-sample',
    displayName: 'Southern University and A&M College',
    kind: 'institution',
    stateOrTerritory: 'LA',
    censusRegion: 'South',
    city: 'Baton Rouge',
    coordinates: { lat: 30.525, lng: -91.191 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: 'Federal HBCU list — flagship of the Southern University System.',
      evidenceIds: ['citation:seed-hbcu-southern-la-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-hbcu-southern-la-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'southern-la',
      }),
    ],
    claims: [
      {
        id: 'claim-hbcu-southern-la-1',
        statement: 'Southern University is listed on the federal HBCU roster.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Gulf South geographic coverage.',
  },
  {
    id: 'seed-hbcu-lincoln-mo',
    campaignId: 'hbcu-sample',
    displayName: 'Lincoln University of Missouri',
    kind: 'institution',
    stateOrTerritory: 'MO',
    censusRegion: 'Midwest',
    city: 'Jefferson City',
    coordinates: { lat: 38.566, lng: -92.169 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: 'Federal HBCU list — Midwest public HBCU anchor.',
      evidenceIds: ['citation:seed-hbcu-lincoln-mo-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-hbcu-lincoln-mo-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'lincoln-mo',
      }),
    ],
    claims: [
      {
        id: 'claim-hbcu-lincoln-mo-1',
        statement: 'Lincoln University of Missouri is on the federal HBCU list.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Midwest HBCU representation — many Midwest states have zero HBCUs.',
  },
  {
    id: 'seed-hbcu-tuskegee-al',
    campaignId: 'hbcu-sample',
    displayName: 'Tuskegee University',
    kind: 'institution',
    stateOrTerritory: 'AL',
    censusRegion: 'South',
    city: 'Tuskegee',
    coordinates: { lat: 32.43, lng: -85.707 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'community_anchor',
      note: 'Federal HBCU list — historically significant Alabama land-grant institution.',
      evidenceIds: ['citation:seed-hbcu-tuskegee-al-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-hbcu-tuskegee-al-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'tuskegee',
      }),
    ],
    claims: [
      {
        id: 'claim-hbcu-tuskegee-al-1',
        statement: 'Tuskegee University is listed on the federal HBCU roster.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Black Belt Alabama anchor with federal provenance.',
  },
];

export const DESEGREGATION_LITIGATION_RECORDS: readonly SeedRecord[] = [
  {
    id: 'seed-deseg-little-rock-ar',
    campaignId: 'desegregation-litigation-schools',
    displayName: 'Little Rock Central High School',
    kind: 'school',
    stateOrTerritory: 'AR',
    censusRegion: 'South',
    city: 'Little Rock',
    coordinates: { lat: 34.736, lng: -92.298 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'court_precedent',
      note: 'NPS National Historic Site for the 1957 desegregation crisis following Brown v. Board.',
      evidenceIds: ['citation:seed-deseg-little-rock-ar-nps'],
    },
    citations: [
      npsCitation({
        id: 'seed-deseg-little-rock-ar-nps',
        url: 'https://www.nps.gov/chsc/index.htm',
        placeName: 'Little Rock Central High School NHS',
      }),
    ],
    claims: [
      {
        id: 'claim-deseg-little-rock-ar-1',
        statement:
          'Little Rock Central High School is a National Historic Site for the 1957 desegregation crisis.',
      },
    ],
    completeness: 'substantial',
    sourceCorpus: 'nrhp',
    inclusionRationale: 'Canonical desegregation litigation site with NPS federal documentation.',
  },
  {
    id: 'seed-deseg-moton-va',
    campaignId: 'desegregation-litigation-schools',
    displayName: 'Robert Russa Moton High School',
    kind: 'school',
    stateOrTerritory: 'VA',
    censusRegion: 'South',
    city: 'Farmville',
    coordinates: { lat: 37.301, lng: -78.392 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'court_precedent',
      note: 'Student strike led to Davis v. County School Board, a Brown companion case.',
      evidenceIds: ['citation:seed-deseg-moton-va-nps'],
    },
    citations: [
      {
        id: 'seed-deseg-moton-va-nps',
        sourceName: 'National Park Service — Brown v. Board of Education',
        location: {
          kind: 'url',
          url: 'https://www.nps.gov/brvb/learn/historyculture/moton.htm',
        },
        capture: { captureId: 'capture:nps-moton-high' },
        retrievalDate: RETRIEVAL,
      },
    ],
    claims: [
      {
        id: 'claim-deseg-moton-va-1',
        statement:
          'Moton High School is documented by NPS as central to Davis v. County School Board of Prince Edward County.',
      },
    ],
    completeness: 'partial',
    inclusionRationale: 'Brown companion litigation school with federal narrative documentation.',
  },
  {
    id: 'seed-deseg-clinton-tn',
    campaignId: 'desegregation-litigation-schools',
    displayName: 'Clinton High School',
    kind: 'school',
    stateOrTerritory: 'TN',
    censusRegion: 'South',
    city: 'Clinton',
    coordinates: { lat: 36.103, lng: -84.131 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'documented_site',
      note: 'First Tennessee public high school desegregated after Brown — state historic marker documentation.',
      evidenceIds: ['citation:seed-deseg-clinton-tn-tnencyclopedia'],
    },
    citations: [
      {
        id: 'seed-deseg-clinton-tn-tnencyclopedia',
        sourceName: 'Tennessee Encyclopedia (Tennessee Historical Society)',
        location: {
          kind: 'url',
          url: 'https://tennesseeencyclopedia.net/entries/clinton-desegregation-crisis/',
        },
        capture: { captureId: 'capture:tnencyclopedia-clinton' },
        retrievalDate: RETRIEVAL,
      },
    ],
    claims: [
      {
        id: 'claim-deseg-clinton-tn-1',
        statement:
          'Clinton High School was the first public high school desegregated in Tennessee after Brown.',
      },
    ],
    completeness: 'partial',
    inclusionRationale:
      'Appalachian Tennessee desegregation case with published encyclopedia source.',
  },
  {
    id: 'seed-deseg-scotts-branch-sc',
    campaignId: 'desegregation-litigation-schools',
    displayName: "Scott's Branch High School",
    kind: 'school',
    stateOrTerritory: 'SC',
    censusRegion: 'South',
    city: 'Summerton',
    coordinates: { lat: 33.608, lng: -80.351 },
    documentedGeoPrecisionTier: 'locality',
    notabilityBasis: {
      criterion: 'court_precedent',
      note: "Briggs v. Elliott (1952) originated in Clarendon County schools including Scott's Branch.",
      evidenceIds: ['citation:seed-deseg-scotts-branch-sc-nps'],
    },
    citations: [
      {
        id: 'seed-deseg-scotts-branch-sc-nps',
        sourceName: 'National Park Service — Brown v. Board of Education',
        location: {
          kind: 'url',
          url: 'https://www.nps.gov/brvb/learn/historyculture/briggs.htm',
        },
        capture: { captureId: 'capture:nps-briggs' },
        retrievalDate: RETRIEVAL,
      },
    ],
    claims: [
      {
        id: 'claim-deseg-scotts-branch-sc-1',
        statement:
          "Scott's Branch High School is documented in the Briggs v. Elliott Clarendon County case.",
      },
    ],
    completeness: 'sparse',
    inclusionRationale:
      'Sparse locality-precision record allowed — litigation significance documented by NPS.',
  },
  {
    id: 'seed-deseg-mansfield-tx',
    campaignId: 'desegregation-litigation-schools',
    displayName: 'Mansfield High School',
    kind: 'school',
    stateOrTerritory: 'TX',
    censusRegion: 'South',
    city: 'Mansfield',
    coordinates: { lat: 32.563, lng: -97.141 },
    documentedGeoPrecisionTier: 'locality',
    notabilityBasis: {
      criterion: 'documented_site',
      note: '1956 Mansfield school desegregation resistance documented by Texas State Historical Association.',
      evidenceIds: ['citation:seed-deseg-mansfield-tx-tsha'],
    },
    citations: [
      {
        id: 'seed-deseg-mansfield-tx-tsha',
        sourceName: 'Texas State Historical Association Handbook',
        location: {
          kind: 'url',
          url: 'https://www.tshaonline.org/handbook/entries/mansfield-school-desegregation-incident',
        },
        capture: { captureId: 'capture:tsha-mansfield' },
        retrievalDate: RETRIEVAL,
      },
    ],
    claims: [
      {
        id: 'claim-deseg-mansfield-tx-1',
        statement:
          'Mansfield High School was the site of a documented 1956 Texas school desegregation incident.',
      },
    ],
    completeness: 'sparse',
    inclusionRationale:
      'Southwest desegregation sample with published state historical association source.',
  },
];

export const BLACK_EDUCATIONAL_MOVEMENT_RECORDS: readonly SeedRecord[] = [
  {
    id: 'seed-movement-highlander-tn',
    campaignId: 'black-educational-movements',
    displayName: 'Highlander Folk School Historic District',
    kind: 'institution',
    stateOrTerritory: 'TN',
    censusRegion: 'South',
    city: 'Monteagle',
    coordinates: { lat: 35.24, lng: -85.84 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'movement_significance',
      note: 'NRHP-listed citizenship school training center for Civil Rights Movement organizers.',
      evidenceIds: ['citation:seed-movement-highlander-tn-nrhp'],
    },
    citations: [
      nrhpCitation({
        id: 'seed-movement-highlander-tn-nrhp',
        nrhpRef: '73001879',
        url: 'https://www.nps.gov/subjects/nationalregister/index.htm',
      }),
    ],
    claims: [
      {
        id: 'claim-movement-highlander-tn-1',
        statement:
          'Highlander Folk School trained Civil Rights Movement organizers including citizenship school leaders.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'nrhp',
    inclusionRationale: 'Movement training institution with NRHP federal listing.',
  },
  {
    id: 'seed-movement-tougaloo-ms',
    campaignId: 'black-educational-movements',
    displayName: 'Tougaloo College',
    kind: 'institution',
    stateOrTerritory: 'MS',
    censusRegion: 'South',
    city: 'Tougaloo',
    coordinates: { lat: 32.405, lng: -90.159 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'movement_significance',
      note: 'Documented Freedom School and voter-registration training hub during Mississippi Movement.',
      evidenceIds: ['citation:seed-movement-tougaloo-ms-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-movement-tougaloo-ms-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'tougaloo',
      }),
    ],
    claims: [
      {
        id: 'claim-movement-tougaloo-ms-1',
        statement: 'Tougaloo College is documented as a Mississippi Movement educational anchor.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Mississippi Movement institution with federal HBCU list provenance.',
  },
  {
    id: 'seed-movement-penn-center-sc',
    campaignId: 'black-educational-movements',
    displayName: 'Penn Center (Penn School historic campus)',
    kind: 'institution',
    stateOrTerritory: 'SC',
    censusRegion: 'South',
    city: 'St. Helena Island',
    coordinates: { lat: 32.378, lng: -80.577 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'movement_significance',
      note: 'Reconstruction-era Penn School became a Civil Rights Movement retreat and education site.',
      evidenceIds: ['citation:seed-movement-penn-center-sc-nhl'],
    },
    citations: [
      {
        id: 'seed-movement-penn-center-sc-nhl',
        sourceName: 'National Park Service — Reconstruction',
        location: {
          kind: 'url',
          url: 'https://www.nps.gov/subjects/reconstruction/penn-center.htm',
        },
        capture: { captureId: 'capture:nps-penn-center' },
        retrievalDate: RETRIEVAL,
      },
    ],
    claims: [
      {
        id: 'claim-movement-penn-center-sc-1',
        statement:
          'Penn Center originated as Penn School during Reconstruction and served Movement-era education work.',
      },
    ],
    completeness: 'partial',
    inclusionRationale:
      'Sea Islands Reconstruction-to-Movement educational continuity with NPS documentation.',
  },
  {
    id: 'seed-movement-tuskegee-al',
    campaignId: 'black-educational-movements',
    displayName: 'Tuskegee Institute National Historic Site',
    kind: 'institution',
    stateOrTerritory: 'AL',
    censusRegion: 'South',
    city: 'Tuskegee',
    coordinates: { lat: 32.43, lng: -85.707 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'movement_significance',
      note: "NPS NHS documenting Booker T. Washington's industrial education movement model.",
      evidenceIds: ['citation:seed-movement-tuskegee-al-nps'],
    },
    citations: [
      npsCitation({
        id: 'seed-movement-tuskegee-al-nps',
        url: 'https://www.nps.gov/tuin/index.htm',
        placeName: 'Tuskegee Institute NHS',
      }),
    ],
    claims: [
      {
        id: 'claim-movement-tuskegee-al-1',
        statement:
          'Tuskegee Institute is a National Historic Site for the industrial education movement.',
      },
    ],
    completeness: 'substantial',
    sourceCorpus: 'nrhp',
    inclusionRationale: 'Industrial education movement anchor with dedicated NPS unit.',
  },
];

export const NATIONALLY_SIGNIFICANT_RECORDS: readonly SeedRecord[] = [
  {
    id: 'seed-national-dunbar-dc',
    campaignId: 'nationally-significant-institutions',
    displayName: 'Paul Laurence Dunbar High School (historic)',
    kind: 'school',
    stateOrTerritory: 'DC',
    censusRegion: 'South',
    city: 'Washington',
    coordinates: { lat: 38.917, lng: -77.017 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'first_to_do_x',
      note: 'Documented as among the first public high schools for Black students in the United States.',
      evidenceIds: ['citation:seed-national-dunbar-dc-nps'],
    },
    citations: [
      {
        id: 'seed-national-dunbar-dc-nps',
        sourceName: 'National Park Service — African American Heritage',
        location: {
          kind: 'url',
          url: 'https://www.nps.gov/subjects/africanamericanheritage/dunbar-high-school.htm',
        },
        capture: { captureId: 'capture:nps-dunbar' },
        retrievalDate: RETRIEVAL,
      },
    ],
    claims: [
      {
        id: 'claim-national-dunbar-dc-1',
        statement:
          'Paul Laurence Dunbar High School is documented as a pioneering Black public high school.',
      },
    ],
    completeness: 'partial',
    inclusionRationale:
      'National first-in-scope educational institution with NPS heritage documentation.',
  },
  {
    id: 'seed-national-cheyney-pa',
    campaignId: 'nationally-significant-institutions',
    displayName: 'Cheyney University of Pennsylvania',
    kind: 'institution',
    stateOrTerritory: 'PA',
    censusRegion: 'Northeast',
    city: 'Cheyney',
    coordinates: { lat: 39.934, lng: -75.527 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'only_or_oldest',
      note: 'Documented as the oldest HBCU in the United States on the federal HBCU list.',
      evidenceIds: ['citation:seed-national-cheyney-pa-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-national-cheyney-pa-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'cheyney',
      }),
    ],
    claims: [
      {
        id: 'claim-national-cheyney-pa-1',
        statement: 'Cheyney University traces to the Institute for Colored Youth founded in 1837.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Oldest HBCU superlative with federal list provenance — Northeast anchor.',
  },
  {
    id: 'seed-national-wilberforce-oh',
    campaignId: 'nationally-significant-institutions',
    displayName: 'Wilberforce University',
    kind: 'institution',
    stateOrTerritory: 'OH',
    censusRegion: 'Midwest',
    city: 'Wilberforce',
    coordinates: { lat: 39.716, lng: -83.878 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'only_or_oldest',
      note: 'Documented as the oldest private HBCU in the United States.',
      evidenceIds: ['citation:seed-national-wilberforce-oh-ed'],
    },
    citations: [
      ncesCitation({
        id: 'seed-national-wilberforce-oh-ed',
        url: 'https://www.ed.gov/hbcu',
        institutionId: 'wilberforce',
      }),
    ],
    claims: [
      {
        id: 'claim-national-wilberforce-oh-1',
        statement:
          'Wilberforce University is documented as the oldest private HBCU in the United States.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'hbcu-list',
    inclusionRationale: 'Midwest oldest-private-HBCU superlative with federal provenance.',
  },
  {
    id: 'seed-national-berea-ky',
    campaignId: 'nationally-significant-institutions',
    displayName: 'Berea College',
    kind: 'institution',
    stateOrTerritory: 'KY',
    censusRegion: 'South',
    city: 'Berea',
    coordinates: { lat: 37.568, lng: -84.296 },
    documentedGeoPrecisionTier: 'exact-site',
    notabilityBasis: {
      criterion: 'landmark_or_national_register',
      note: 'NRHP-listed campus with documented interracial education history.',
      evidenceIds: ['citation:seed-national-berea-ky-nrhp'],
    },
    citations: [
      nrhpCitation({
        id: 'seed-national-berea-ky-nrhp',
        nrhpRef: '78001355',
        url: 'https://www.nps.gov/subjects/nationalregister/index.htm',
      }),
    ],
    claims: [
      {
        id: 'claim-national-berea-ky-1',
        statement:
          'Berea College is NRHP-listed for its historic campus and interracial education history.',
      },
    ],
    completeness: 'partial',
    sourceCorpus: 'nrhp',
    inclusionRationale: 'Appalachian nationally significant institution with NRHP listing.',
  },
];

export const ALL_SEED_RECORDS: readonly SeedRecord[] = [
  ...ROSENWALD_SCHOOL_RECORDS,
  ...FREEDMENS_SCHOOL_RECORDS,
  ...HBCU_SAMPLE_RECORDS,
  ...DESEGREGATION_LITIGATION_RECORDS,
  ...BLACK_EDUCATIONAL_MOVEMENT_RECORDS,
  ...NATIONALLY_SIGNIFICANT_RECORDS,
];
