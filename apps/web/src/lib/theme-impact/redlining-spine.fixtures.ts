/**
 * Redlining theme spine fixture (repo-cqey.10): the first real folded theme spine, proving
 * the `themeBinding` / `moments` / `disputes` shape end-to-end (repo-cqey.2–.6) with real
 * published `ThemeImpactPacket` data for the `redlining` theme.
 *
 * Every figure below traces to a real packet in
 * `packages/domain/src/statistics/researched-theme-impact-packets.ts`
 * (`tip_chicago_redlining_q1`..`q4`) by `packetId` + `refId` — no invented numbers. Prose
 * follows `docs/ui/voice-theme-chapters.md`'s five rules; see the review note in
 * `redlining-spine.test.ts` for how each rule is satisfied.
 *
 * This is fixture-layer content only: these stories are not wired into any live read path.
 * They exist so `resolveThemeSpine('redlining', { listStories: ... })` can be exercised with
 * real, hydratable data via test-only dependency injection (see `source.ts`'s `deps` param).
 */
import type { PublicStoryProjectionDoc } from '@repo/schemas';

/**
 * Real entity ids bound to this theme's packets via `entityBinding` (see
 * `tip_chicago_redlining_q1`'s `ent_chicago_race_riot_1919_001` and `tip_chicago_redlining_q4`'s
 * `ent_bronzeville_001`). Using the same ids as `relatedEntityIds` here means
 * `resolveEntityCrossReferences` (repo-cqey.8) resolves them automatically — it matches
 * `packet.entityBinding.entityId` directly, with no separate entity-fixture lookup required.
 */
const ENT_CHICAGO_RACE_RIOT_1919 = 'ent_chicago_race_riot_1919_001';
const ENT_BRONZEVILLE = 'ent_bronzeville_001';

const SOURCES: PublicStoryProjectionDoc['sources'] = [
  {
    label: 'National Archives, Record Group 195 (HOLC/FHLBB records)',
    url: 'https://www.archives.gov/research/guide-fed-records/groups/195.html',
  },
  {
    label: 'Mapping Inequality: Redlining in New Deal America (Univ. of Richmond DSL)',
    url: 'https://dsl.richmond.edu/panorama/redlining/static/mappinginequality.json',
  },
  {
    label: 'Amy E. Hillier, "Redlining and the Home Owners’ Loan Corporation" (2003)',
    url: 'https://repository.upenn.edu/server/api/core/bitstreams/8c48fb68-5ccf-4e1e-aa6c-0c04ba18da4d/content',
  },
];

/**
 * Chapter 1 of 3 — bound to `tip_chicago_redlining_q1` ("Before the maps: a color line walked
 * into federal credit"). Opens on Eugene Williams and the 1919 Chicago Race Riot, the documented
 * private color line that predates the federal HOLC/FHA credit system the rest of the spine
 * traces. `entityBinding` on Q1 is `ent_chicago_race_riot_1919_001`, matched here in
 * `relatedEntityIds`.
 */
const CHAPTER_ONE: PublicStoryProjectionDoc = {
  id: 'story_redlining_spine_ch1',
  releaseId: 'rel-fixture-redlining-spine',
  slug: 'before-the-maps',
  title: 'Before the Maps',
  dek: 'A color line drawn in Lake Michigan reached federal credit six years before anyone unrolled a Home Owners’ Loan Corporation sheet.',
  publishedAt: '2026-07-25',
  eraLabel: 'Great Migration to HOLC/FHA',
  placeLabel: 'Chicago, IL',
  relatedEntityIds: [ENT_CHICAGO_RACE_RIOT_1919],
  sources: SOURCES,
  themeBinding: { themeId: 'redlining', chapterIndex: 1, chapterCount: 3 },
  body: [
    {
      heading: 'A line in the water',
      paragraphs: [
        'On the afternoon of July 27, 1919, Eugene Williams, seventeen, drifted on a raft past the invisible line in Lake Michigan that separated the 29th Street Beach’s Black swimming area from the white one to the north. A group of white bathers began throwing rocks. One struck Williams. He drowned within sight of the shore, and the police officer on the beach declined to arrest the man bystanders identified as the thrower.',
        'The riot lasted a week. By the time state militia restored order, thirty-eight people were dead and thousands of Black Chicagoans, many of them recent arrivals from the rural South, were left without homes on a South Side already crowded past its private housing stock.',
        'No federal map drew that line in the water. It was enforced the same way the neighborhood covenants around the beach were enforced that summer: privately, immediately, and without a signature to later hold accountable. The credit system that would formalize it was still fourteen years away.',
      ],
      moments: [
        { packetId: 'tip_chicago_redlining_q1', kind: 'artifact', refId: 'art_chicago_race_riot_1919_ech', placement: 'after' },
      ],
      disputes: [],
    },
    {
      heading: 'The line becomes federal',
      paragraphs: [
        'The Home Owners’ Loan Act of 1933 created the Corporation that would, three years later, send surveyors block by block through cities like Chicago to grade mortgage risk. The National Housing Act of 1934 created the Federal Housing Administration, whose underwriting manual instructed appraisers to reward "harmonious" racial occupancy and restrictive covenants as evidence of a stable investment.',
        'Neither statute named Eugene Williams or the beach where he drowned. Neither needed to. The private color line that killed him in 1919 was, by 1938, written into the underwriting language a bank loan officer consulted before approving a mortgage.',
      ],
      moments: [],
      disputes: [],
    },
  ],
};

/**
 * Chapter 2 of 3 — bound to `tip_chicago_redlining_q2` ("Spread the Chicago sheets"). Reads the
 * HOLC survey inventory itself, then renders the genuine scholarly dispute over what the maps
 * prove: the National Archives/Rothstein reading (federal grading built race into mortgage risk)
 * against Hillier (2003), who argues the maps are evidence of appraisal language, not proof by
 * themselves of the lending practice that followed.
 */
const CHAPTER_TWO: PublicStoryProjectionDoc = {
  id: 'story_redlining_spine_ch2',
  releaseId: 'rel-fixture-redlining-spine',
  slug: 'spread-the-sheets',
  title: 'Spread the Sheets',
  dek: 'A direct recount of the Chicago HOLC survey, and the argument over what the color on the map can and cannot prove.',
  publishedAt: '2026-07-25',
  eraLabel: 'HOLC survey era',
  placeLabel: 'Chicago, IL',
  relatedEntityIds: [ENT_CHICAGO_RACE_RIOT_1919],
  sources: SOURCES,
  themeBinding: { themeId: 'redlining', chapterIndex: 2, chapterCount: 3 },
  body: [
    {
      heading: 'The inventory',
      paragraphs: [
        'A direct recount of the Chicago Home Owners’ Loan Corporation inventory, held today by the National Archives and digitized by the University of Richmond’s Digital Scholarship Lab, yields seven hundred and three features. After trimming grade whitespace, six hundred and eighty-three carry a letter grade: forty-nine "A," a hundred and sixty "B," three hundred and twenty-seven "C," a hundred and forty-seven "D." Twenty more are ungraded commercial or industrial parcels, left off the residential scale entirely.',
        'The area descriptions filed beside those letters name race directly as a risk factor, the way the underwriting manual instructed. What the polygons do not give up, on their own, is how many Black Chicagoans lived inside each graded parcel. That count was never tallied at the time, and no later reconstruction has closed the gap. The record stays honest about what it cannot show rather than filling the silence with an estimate.',
      ],
      moments: [
        { packetId: 'tip_chicago_redlining_q2', kind: 'artifact', refId: 'art_mapping_inequality_chicago_verified', placement: 'after' },
      ],
      disputes: [],
    },
    {
      heading: 'What the sheets prove',
      paragraphs: [
        'Two readings of the same archive sit in tension, and neither has been reconciled into a single settled account. The first traces directly from the surveyors’ own language and the Federal Housing Administration’s 1938 underwriting manual: the federal grading system took a private, informal color line and wrote it into the risk math a bank loan officer consulted before every mortgage decision, a national credit machine built to enforce segregation. The second, argued by the historian Amy Hillier in her 2003 study of Philadelphia’s HOLC records, is narrower: the maps themselves document appraisal language, but the surviving evidence does not show HOLC directly refusing loans on the strength of its own grades. The maps and the documented lending practice, she argues, are two different records, and treating the first as sufficient proof of the second overstates what either one shows.',
      ],
      moments: [],
      disputes: [
        {
          label: 'What the HOLC grade sheets prove',
          sideA: {
            sourceLabel: 'National Archives Record Group 195, read through the underwriting manual and the national credit-system account',
            claim: 'Federal grading built the private color line into national mortgage risk assessment, making the maps direct evidence of a discriminatory credit system.',
          },
          sideB: {
            sourceLabel: 'Amy E. Hillier, "Redlining and the Home Owners’ Loan Corporation," Journal of Urban History (2003)',
            claim: 'The HOLC maps document appraisal language, but the surviving Philadelphia lending records do not themselves show HOLC refusing loans on the strength of its own grades — mapmaking and lending practice are separate records.',
          },
        },
      ],
    },
  ],
};

/**
 * Chapter 3 of 3 — bound to `tip_chicago_redlining_q4` ("Bronzeville on the map") and drawing
 * county-level instrument data from `tip_chicago_redlining_q3`. Opens on Robert S. Abbott and
 * the documented Bronzeville institutions named directly in the Q4 packet summary, then walks
 * the county forward through homeownership, lending-denial, cost-burden, and wealth figures the
 * instruments actually resolve to. `entityBinding` on Q4 is `ent_bronzeville_001`, matched here
 * in `relatedEntityIds`.
 */
const CHAPTER_THREE: PublicStoryProjectionDoc = {
  id: 'story_redlining_spine_ch3',
  releaseId: 'rel-fixture-redlining-spine',
  slug: 'the-county-still-holds-the-tape-measure',
  title: 'The County Still Holds the Tape Measure',
  dek: 'Bronzeville held the institutions that outlasted the grade sheets. The county instruments that follow can only measure as far as the county line.',
  publishedAt: '2026-07-25',
  eraLabel: 'HOLC/FHA to fair-housing era',
  placeLabel: 'Bronzeville, Chicago, IL',
  relatedEntityIds: [ENT_BRONZEVILLE],
  sources: SOURCES,
  themeBinding: { themeId: 'redlining', chapterIndex: 3, chapterCount: 3 },
  body: [
    {
      heading: 'Bronzeville',
      paragraphs: [
        'Robert S. Abbott moved to Chicago in 1897 and founded the Chicago Defender in 1905, printing it from a South Side office that would, within two decades, sit inside the district Drake and Cayton later named Bronzeville. Overton Hygienic, Supreme Life, and the Wabash Avenue YMCA grew up on the same blocks, a Black commercial and civic corridor that survived the 1919 riot and was still standing when the HOLC surveyors arrived in the 1930s to grade it.',
        'The Corporation’s grade sheets and the Federal Housing Administration’s underwriting rules passed over that same geography without naming a single business on State Street. What they left behind is a county-level statistical record: homeownership, lending denial, cost burden, each series resolving only to Cook County as a whole, not to Bronzeville’s blocks specifically. The place and the numbers sit side by side; closing the distance between them is unfinished work, not a settled fact.',
      ],
      moments: [
        { packetId: 'tip_chicago_redlining_q4', kind: 'derived', refId: 'der_cook_homeownership_gap_2010', placement: 'after' },
      ],
      disputes: [],
    },
    {
      heading: 'The county instruments',
      paragraphs: [
        'The homeownership gap in the previous figure did not close as the county aged. Home Mortgage Disclosure Act records for Cook County still separate applicants by outcome eight decades after the first HOLC survey: in 2018 the county’s Black applicant denial rate ran meaningfully above the White applicant rate. HUD’s Comprehensive Housing Affordability Strategy data for 2017 through 2021 shows a comparable split in who carries a housing cost burden above thirty percent of income.',
        'Median household income in the county tells the same story in dollars rather than percentages, and the Survey of Consumer Finances places that county-level gap inside a national one that has held for decades in family wealth. None of these instruments can be walked back inside Bronzeville’s specific blocks; the county is as fine-grained as the record currently allows.',
      ],
      moments: [
        { packetId: 'tip_chicago_redlining_q3', kind: 'observation', refId: 'obs:hmda-denial-rate-gap-black-white-county:county:17031:2018', placement: 'after' },
        { packetId: 'tip_chicago_redlining_q3', kind: 'derived', refId: 'der_cook_income_gap_2020_2024', placement: 'after' },
        { packetId: 'tip_chicago_redlining_q4', kind: 'derived', refId: 'der_cook_cost_burden_gap_2017_2021', placement: 'after' },
      ],
      disputes: [],
    },
    {
      heading: 'What still stands',
      paragraphs: [
        'The Chicago Defender building changed hands and addresses more than once across the twentieth century, but the paper Abbott founded on those blocks outlived the grade that was once stamped on the district around it.',
      ],
      moments: [],
      disputes: [],
    },
  ],
};

export const REDLINING_SPINE_STORIES: readonly PublicStoryProjectionDoc[] = [
  CHAPTER_ONE,
  CHAPTER_TWO,
  CHAPTER_THREE,
];
