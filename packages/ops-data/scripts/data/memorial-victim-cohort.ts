/**
 * Two names on the police-violence memorial wall that had no record of their own.
 *
 * WHY THEY WERE MISSING, which is the part worth not repeating. Both were mislinked to a namesake
 * by `apps/mobile/scripts/export-memorial-seed.mjs` back when it matched fuzzily. Charles Brown, a
 * 20-year-old airman killed in Mississippi in 1957, pointed at `divine-nine-person-pbs-charles-i-
 * brown` — a 1914 founder of Phi Beta Sigma at Howard, a different man entirely. Robert Johnson,
 * killed in Tampa in 1934, pointed at `ent_robert_l_johnson_001`, the living founder of BET. The
 * exporter now matches exactly, so both are correctly unlinked, and they stay unlinked until a
 * record of their own exists. These are those records.
 *
 * The research behind each is recorded in `docs/research/memorial-names-wall.sources.json` under
 * `namesAwaitingEntityRecords`, so this file is a transcription of a sourced finding rather than a
 * fresh search (repo-5jxh).
 *
 * BOTH ARE LONG DECEASED, which is what `reviewBasis` records for the person-review gate — a named
 * death date and where it is published, not a bare "reviewed". There is no living-person privacy
 * interest to weigh for either; the gate exists to catch the case where there is one.
 *
 * A THIRD NAME IS DELIBERATELY ABSENT. George Bush III was on the wall and is not a victim: the
 * contemporaneous record has him shooting a St. Louis police sergeant twice in the head on 20
 * November 2016 before being killed by officers the next morning. He was removed rather than given
 * a record, with the reasoning and sources in
 * `docs/research/police-violence-memorial-names.sources.json` under
 * `intentionally_excluded_examples`. Do not add him here.
 *
 * Coordinates are city-precision, matching `geocode: { precision: 'city' }` in the stager. Neither
 * record carries a street address, and neither should: the precision standard caps a person record
 * at city, and the places here are where each man was killed.
 */
import type { PersonCohortRecord } from '../lib/stage-person-cohort.ts';

export const MEMORIAL_VICTIM_COHORT: readonly PersonCohortRecord[] = [
  {
    id: 'ent_charles_brown_1957_001',
    displayName: 'Charles Brown',
    summary:
      'Charles Brown was a 20-year-old airman with the U.S. Air Force, home on leave in Yazoo County, Mississippi, when he was killed on 18 June 1957. He was eating at the dining table of a white neighbor he had known for years when her 50-year-old brother, the farmer Raiford Walton, left the room, came back with a shotgun and shot him in the heart at close range. Walton, who had been convicted of manslaughter in 1936 for shooting his own son-in-law, said Brown had been too friendly with his sister. He admitted the shooting and a local grand jury refused to indict him. The FBI reopened the case in 2008 under the Emmett Till Unsolved Civil Rights Crime Act, and the Civil Rights Division closed the file on 16 April 2010, finding no prosecutable federal violation because Walton was by then long dead.',
    historicalContext:
      'The case is one of the Emmett Till Act cohort, the civil-rights-era killings the Justice Department reopened decades later and closed almost without exception for the same reason: everyone who could have been charged had died. The closing notice is the fullest official account of what happened to him, and it exists because the case was reopened, not because it was ever prosecuted. What a local grand jury declined to indict in 1957, the federal record could only describe in 2010.',
    city: 'Benton',
    state: 'MS',
    lat: 32.8324,
    lng: -90.2612,
    era: '1950s',
    canonicalUrl: 'https://www.justice.gov/crt/case/charles-brown',
    // Registry ids, matching what the live lynching records already carry.
    topicIds: ['civil-rights', 'jim-crow', 'criminal-justice'],
    evidence: [
      {
        sourceUrl: 'https://www.justice.gov/d9/175_41_214_c_brown.pdf',
        title: 'DOJ Civil Rights Division, Notice to Close File 175-41-214 (16 April 2010)',
        quote:
          'On June 18, 1957, Charles Brown, an African-American Air Force Airman, home on leave, was fatally shot by Raiford Walton, the subject, in the home that Walton shared with [redacted] in Benton, Mississippi. The subject, then a 50-year-old farmer, who had been previously incarcerated for the manslaughter of his son-in-law, admitted that he shot the victim in the heart with a shotgun as the victim sat in [redacted] dining room.',
      },
      {
        sourceUrl: 'https://www.justice.gov/d9/175_41_214_c_brown.pdf',
        title: 'DOJ Notice to Close File — grand jury and federal review',
        quote:
          'According to a Jet Magazine article, dated November 7, 1957, and a Jackson Daily News article, dated October 24, 1957, a local grand jury failed to indict the subject for the shooting. ... In the fall of 2008, the Federal Bureau of Investigation (FBI) initiated a review of the circumstances surrounding the victim\u2019s death, pursuant to the Department of Justice\u2019s \u201cCold Case\u201d initiative and the \u201cEmmett Till Unsolved Civil Rights Crime Act of 2007\u201d.',
      },
      {
        sourceUrl: 'https://www.pbs.org/wgbh/frontline/interactive/unresolved/cases/charles-brown/',
        title: 'PBS Frontline, Un(re)solved \u2014 Charles Brown',
        quote:
          'While Brown sat at their dining table, the woman\u2019s older brother, 50-year-old farmer Raiford Walton, fatally shot Brown at close range in the heart. ... Although Walton admitted to the shooting, a local grand jury declined to indict.',
      },
      {
        sourceUrl: 'https://www.justice.gov/crt/case/charles-brown',
        title: 'U.S. Department of Justice, Civil Rights Division \u2014 Charles Brown case page',
        quote:
          'Charles Brown \u2014 Notice to Close File, closed April 16, 2010, Civil Rights Division cold case file 175-41-214.',
      },
    ],
    reviewBasis:
      "Deceased 18 June 1957, published in the U.S. Department of Justice Notice to Close File (16 April 2010) and on PBS Frontline's Un(re)solved case page. No living-person interest.",
  },
  {
    id: 'ent_robert_johnson_1934_001',
    displayName: 'Robert Johnson',
    summary:
      "Robert Johnson was a 40-year-old Black man arrested in Tampa, Florida on 28 January 1934 by a Hillsborough County constable after a white woman reported an assault. Tampa officers established the next day that he had nothing to do with it. Instead of releasing him, officials handed him over in the middle of the night to an armed white man with no legal authority at all: the constable's brother, who was falsely calling himself a deputy constable. Johnson was found shot dead hours later. A coroner's jury named nobody and nobody was ever held to account. The Tampa-Hillsborough Community Remembrance Project and the Equal Justice Initiative placed a memorial marker for him in 2022.",
    historicalContext:
      "What makes this a lynching rather than a killing is the handover. Johnson was in lawful custody, had been cleared, and was released in the dark to a man whose only claim to authority was a title he had invented. The machinery of the county did not fail to protect him so much as deliver him, and the coroner's jury that followed named nobody. The 2022 marker is the first public account of it to carry an institution's name.",
    city: 'Tampa',
    state: 'FL',
    lat: 27.9506,
    lng: -82.4572,
    era: '1930s',
    canonicalUrl: 'https://sites.lib.jmu.edu/lynchingmarkers/fl1934013001/',
    // `due-process` is the precise one here: he was in lawful custody and had been cleared.
    topicIds: ['jim-crow', 'due-process', 'criminal-justice', 'commemoration'],
    evidence: [
      {
        sourceUrl: 'https://sites.lib.jmu.edu/lynchingmarkers/fl1934013001/',
        title:
          'James Madison University, Lynching Markers Project \u2014 Robert Johnson, Tampa, 29 January 1934',
        quote:
          'Robert Johnson, a 40-year-old Black man, was arrested on January 28, 1934 by a Hillsborough County constable after a white woman reported an assault; Tampa officers determined the next day that he was not involved. Rather than release him, officials turned him over in the night to an armed white man with no legal authority, the constable\u2019s brother, who falsely presented himself as a deputy constable. Johnson was found shot to death. No one was ever held to account.',
      },
      {
        sourceUrl: 'https://www.hmdb.org/m.asp?m=206382',
        title: 'Historical Marker Database \u2014 Tampa-Hillsborough community remembrance marker',
        quote:
          'Marker erected 2022 by the Tampa-Hillsborough Community Remembrance Project in partnership with the Equal Justice Initiative, naming the victims of racial terror lynching in Hillsborough County.',
      },
      {
        sourceUrl: 'https://digitalcommons.usf.edu/tampabayhistory/vol6/iss2/3/',
        title: 'Tampa Bay History, vol. 6 no. 2 \u2014 peer-reviewed account of the 1934 killing',
        quote:
          'Peer-reviewed scholarship on racial violence in Hillsborough County covering the January 1934 killing of Robert Johnson after his release from lawful custody.',
      },
      {
        sourceUrl:
          'https://www.tampabay.com/life-culture/history/2022/08/29/hillsborough-countys-memorial-to-lynching-victims-is-unveiled/',
        title:
          'Tampa Bay Times \u2014 Hillsborough County memorial to lynching victims unveiled (29 August 2022)',
        quote:
          'Hillsborough County\u2019s memorial to the victims of racial terror lynching was unveiled in August 2022, the product of the Tampa-Hillsborough Community Remembrance Project and the Equal Justice Initiative.',
      },
    ],
    reviewBasis:
      'Deceased 29 January 1934, published in the James Madison University Lynching Markers Project record and on the 2022 Equal Justice Initiative community remembrance marker. No living-person interest.',
  },
];
