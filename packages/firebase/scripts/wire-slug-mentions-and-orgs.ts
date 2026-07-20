/**
 * One-shot catalog repair (repo-ts13): create missing org/campaign entity records,
 * remap legacy slug `mentionedEntityIds` to canonical `ent_*` ids, and surgically wire
 * `related[]` (slug targets + mosaic people + founding↔org only — never every mention,
 * which floods hubs past the adjacency cap and drops critical edges).
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/wire-slug-mentions-and-orgs.ts
 *
 * If a prior run flooded related[], repair with:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/narrow-related-wiring.ts
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCatalogRelationships, LEGACY_MENTION_TAG_TO_ENTITY_ID } from '@repo/domain';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CATALOG_DIR = join(ROOT, 'packages/firebase/fixtures/national-catalog');

type RelatedEntry = {
  readonly id: string;
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
};

type CatalogEntity = {
  id: string;
  kind: string;
  displayName: string;
  summary: string;
  eraBuckets?: string[];
  topicTags?: string[];
  jurisdictionLabel?: string;
  locationPrecision?: string;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  claims?: readonly Record<string, unknown>[];
  historicalContext?: string;
  topicIds?: string[];
  mentionedEntityIds?: string[];
  keywords?: string[];
  related?: RelatedEntry[];
  [key: string]: unknown;
};

const SLUG_TO_ENTITY_ID = LEGACY_MENTION_TAG_TO_ENTITY_ID;

const FOUNDING_TO_ORG: ReadonlyArray<{ foundingId: string; orgId: string }> = [
  { foundingId: 'ent_sclc_founding_001', orgId: 'ent_sclc_001' },
  { foundingId: 'ent_sncc_founding_001', orgId: 'ent_sncc_001' },
  { foundingId: 'ent_naacp_founding_001', orgId: 'ent_naacp_001' },
  { foundingId: 'ent_core_founding_001', orgId: 'ent_core_001' },
  { foundingId: 'ent_mfdp_dnc_challenge_001', orgId: 'ent_mfdp_001' },
];

function walkJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name === 'denylist.json') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name.startsWith('_')) continue;
      out.push(...walkJsonFiles(full));
    } else if (name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function addRelated(entity: CatalogEntity, entry: RelatedEntry): void {
  const existing = entity.related ?? [];
  if (existing.some((r) => r.id === entry.id && r.type === entry.type && r.direction === entry.direction)) {
    return;
  }
  entity.related = [...existing, entry];
}

function inferRelation(
  sourceKind: string,
  targetKind: string,
): { type: string; direction: 'outgoing' | 'incoming' } {
  if (sourceKind === 'person' && (targetKind === 'organization' || targetKind === 'institution')) {
    return { type: 'member_of', direction: 'outgoing' };
  }
  if (sourceKind === 'person' && (targetKind === 'event' || targetKind === 'movement')) {
    return { type: 'participated_in', direction: 'outgoing' };
  }
  if (sourceKind === 'place' && targetKind === 'event') {
    return { type: 'occurred_at', direction: 'incoming' };
  }
  if (sourceKind === 'event' && targetKind === 'place') {
    return { type: 'occurred_at', direction: 'outgoing' };
  }
  if (sourceKind === 'case' && targetKind === 'law') {
    return { type: 'related_to', direction: 'outgoing' };
  }
  if (sourceKind === 'organization' && targetKind === 'event') {
    return { type: 'participated_in', direction: 'outgoing' };
  }
  if (sourceKind === 'event' && targetKind === 'organization') {
    return { type: 'related_to', direction: 'outgoing' };
  }
  if (sourceKind === 'movement' && targetKind === 'organization') {
    return { type: 'related_to', direction: 'outgoing' };
  }
  return { type: 'related_to', direction: 'outgoing' };
}

const NEW_ENTITIES: ReadonlyArray<{ file: string; entity: CatalogEntity }> = [
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_sclc_001',
      kind: 'organization',
      displayName: 'Southern Christian Leadership Conference (SCLC)',
      summary:
        'Founded in Atlanta in 1957 by Black ministers and civil rights leaders including Martin Luther King Jr., the Southern Christian Leadership Conference coordinated nonviolent mass campaigns across the South — from Birmingham and St. Augustine to the Poor People\'s Campaign — as a clergy-led network rooted in the Montgomery bus boycott.',
      eraBuckets: ['1950s', '1960s'],
      topicTags: ['civil-rights', 'organizing', 'nonviolence'],
      jurisdictionLabel: 'Atlanta, Georgia',
      locationPrecision: 'institution',
      locationLabel: 'Ebenezer Baptist Church area / Auburn Avenue, Atlanta',
      lat: 33.7554,
      lng: -84.3743,
      claims: [
        {
          predicate: 'founded_in',
          object:
            'January 1957 in Atlanta as a permanent organization emerging from the Montgomery Improvement Association network, with Martin Luther King Jr. as its first president',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/southern-christian-leadership-conference.htm',
          citationLabel: 'National Park Service: Southern Christian Leadership Conference',
        },
        {
          predicate: 'coordinated',
          object:
            'nonviolent direct-action campaigns including the 1963 Birmingham Campaign, the St. Augustine movement, and the 1968 Poor People\'s Campaign',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/southern-christian-leadership-conference.htm',
          citationLabel: 'National Park Service: Southern Christian Leadership Conference',
        },
      ],
      historicalContext:
        'SCLC gave the Montgomery bus boycott\'s clergy leadership a regional structure. Unlike SNCC\'s student-led field organizing, SCLC centered ministers and church networks while collaborating (and sometimes competing) with SNCC, CORE, and the NAACP on shared campaigns.',
      topicIds: ['civil-rights', 'organizing', 'nonviolence'],
      mentionedEntityIds: [
        'ent_sclc_founding_001',
        'ent_martin_luther_king_jr_001',
        'ent_ralph_abernathy_001',
        'ent_birmingham_campaign_001',
        'ent_montgomery_bus_boycott_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_sclc_founding_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_ebenezer_baptist_atlanta_001', type: 'located_at', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_sncc_001',
      kind: 'organization',
      displayName: 'Student Nonviolent Coordinating Committee (SNCC)',
      summary:
        'Formed at Shaw University in April 1960 under Ella Baker\'s convening, SNCC became the student-led engine of sit-ins, Freedom Rides follow-on work, Mississippi voter registration, Freedom Summer, and the Lowndes County Freedom Organization — prioritizing local leadership over top-down celebrity.',
      eraBuckets: ['1960s'],
      topicTags: ['civil-rights', 'organizing', 'student-activism'],
      jurisdictionLabel: 'Raleigh, North Carolina',
      locationPrecision: 'campus',
      locationLabel: 'Shaw University, Raleigh (founding conference)',
      lat: 35.77207,
      lng: -78.6382,
      claims: [
        {
          predicate: 'founded_at',
          object:
            'Shaw University in Raleigh, North Carolina, over Easter weekend April 1960, when Ella Baker convened 126 student sit-in leaders who formed an independent coordinating committee',
          confidenceLevel: 'high',
          citationSource: 'snccdigital.org',
          citationHref: 'https://snccdigital.org/events/founding-of-sncc/',
          citationLabel: 'SNCC Digital Gateway: Founding of SNCC',
        },
        {
          predicate: 'organized',
          object:
            'statewide voter-registration and Freedom Summer projects in Mississippi through COFO, and fielded organizers across the Deep South including Southwest Georgia and the Alabama Black Belt',
          confidenceLevel: 'high',
          citationSource: 'snccdigital.org',
          citationHref: 'https://snccdigital.org/inside-sncc/',
          citationLabel: 'SNCC Digital Gateway: Inside SNCC',
        },
      ],
      historicalContext:
        'SNCC\'s "group-centered leadership" model, urged by Baker, distinguished it from SCLC. By the mid-1960s its program ranged from nonviolent direct action to Black Power politics, while remaining a primary target of white supremacist violence in Mississippi and Alabama.',
      topicIds: ['civil-rights', 'organizing', 'student-activism'],
      mentionedEntityIds: [
        'ent_sncc_founding_001',
        'ent_ella_baker_001',
        'ent_freedom_summer_001',
        'ent_freedom_rides_001',
        'ent_cofo_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_sncc_founding_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_shaw_university_001', type: 'located_at', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'freedom.json',
    entity: {
      id: 'ent_naacp_001',
      kind: 'organization',
      displayName: 'National Association for the Advancement of Colored People (NAACP)',
      summary:
        'Founded after the 1909 National Negro Conference in New York, the NAACP became the nation\'s longest-running civil rights organization, combining legal challenges, anti-lynching campaigns, and local branch organizing from Ida B. Wells\'s generation through Brown v. Board and the Voting Rights Act era.',
      eraBuckets: ['1900s', '1910s', '1960s'],
      topicTags: ['civil-rights', 'organizing', 'freedom'],
      jurisdictionLabel: 'New York, New York',
      locationPrecision: 'institution',
      locationLabel: 'United Charities Building area, Manhattan (founding conference)',
      lat: 40.7395,
      lng: -73.9867,
      claims: [
        {
          predicate: 'founded_from',
          object:
            'the National Negro Conference convened May 31–June 1, 1909 in New York, with the Committee of Forty adopting the NAACP name in 1910',
          confidenceLevel: 'high',
          citationSource: 'loc.gov',
          citationHref: 'https://www.loc.gov/exhibits/naacp/founding-and-early-years.html',
          citationLabel: 'Library of Congress: NAACP — Founding and Early Years',
        },
        {
          predicate: 'pursued',
          object:
            'a dual strategy of litigation and local branch organizing against segregation, disfranchisement, and lynching across the twentieth century',
          confidenceLevel: 'high',
          citationSource: 'loc.gov',
          citationHref: 'https://www.loc.gov/exhibits/naacp/founding-and-early-years.html',
          citationLabel: 'Library of Congress: NAACP — Founding and Early Years',
        },
      ],
      historicalContext:
        'Absorbing energy from the Niagara Movement, the NAACP built a national legal and branch infrastructure that later intersected with mass direct-action groups (SCLC, SNCC, CORE) while remaining the primary vehicle for many local activists and cases.',
      topicIds: ['civil-rights', 'organizing', 'freedom'],
      mentionedEntityIds: [
        'ent_naacp_founding_001',
        'ent_ida_b_wells_001',
        'ent_niagara_movement_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_naacp_founding_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_niagara_movement_001', type: 'related_to', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_core_001',
      kind: 'organization',
      displayName: 'Congress of Racial Equality (CORE)',
      summary:
        'Founded in Chicago in 1942 by an interracial Fellowship of Reconciliation circle including James Farmer, CORE pioneered sit-ins and interracial nonviolent direct action, later organizing the 1947 Journey of Reconciliation and helping launch the 1961 Freedom Rides.',
      eraBuckets: ['1940s', '1960s'],
      topicTags: ['civil-rights', 'organizing', 'direct-action', 'nonviolence'],
      jurisdictionLabel: 'Chicago, Illinois',
      locationPrecision: 'city',
      locationLabel: 'Hyde Park, Chicago (founding)',
      lat: 41.7943,
      lng: -87.5907,
      claims: [
        {
          predicate: 'founded_in',
          object:
            '1942 in Chicago by interracial students and pacifists associated with the Fellowship of Reconciliation, including James Farmer',
          confidenceLevel: 'high',
          citationSource: 'history.com',
          citationHref: 'https://www.history.com/articles/congress-of-racial-equality',
          citationLabel: 'HISTORY: Congress of Racial Equality (CORE)',
        },
        {
          predicate: 'organized',
          object:
            'the 1947 Journey of Reconciliation through the Upper South and partnered on the 1961 Freedom Rides challenging segregated interstate travel',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/freedomrides.htm',
          citationLabel: 'National Park Service: Freedom Rides',
        },
      ],
      historicalContext:
        'CORE\'s early experiments with Gandhian nonviolence shaped later mass campaigns. In the 1960s it worked alongside SNCC and COFO in the Deep South while maintaining chapters nationwide.',
      topicIds: ['civil-rights', 'organizing', 'direct-action', 'nonviolence'],
      mentionedEntityIds: [
        'ent_core_founding_001',
        'ent_journey_of_reconciliation_001',
        'ent_freedom_rides_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_core_founding_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_journey_of_reconciliation_001', type: 'participated_in', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_mfdp_001',
      kind: 'organization',
      displayName: 'Mississippi Freedom Democratic Party (MFDP)',
      summary:
        'Organized in 1964 as an integrated alternative to Mississippi\'s segregated regular Democratic Party, the MFDP ran parallel primaries, sent a 68-delegate challenge delegation to the Atlantic City convention, and forced a national reckoning over Black political exclusion in the South.',
      eraBuckets: ['1960s'],
      topicTags: ['civil-rights', 'voting-rights', 'politics'],
      jurisdictionLabel: 'Jackson, Mississippi',
      locationPrecision: 'city',
      locationLabel: 'Jackson, Mississippi (state organizing base)',
      lat: 32.2988,
      lng: -90.1848,
      claims: [
        {
          predicate: 'formed_in',
          object:
            '1964 to provide an open, integrated Democratic Party structure for Mississippi voters excluded from the segregated regular party',
          confidenceLevel: 'high',
          citationSource: 'blackpast.org',
          citationHref:
            'https://blackpast.org/african-american-history/mississippi-freedom-democratic-party/',
          citationLabel: 'BlackPast.org: Mississippi Freedom Democratic Party',
        },
        {
          predicate: 'challenged',
          object:
            'the seating of Mississippi\'s all-white regular delegation at the August 1964 Democratic National Convention in Atlantic City',
          confidenceLevel: 'high',
          citationSource: 'blackpast.org',
          citationHref:
            'https://blackpast.org/african-american-history/mississippi-freedom-democratic-party/',
          citationLabel: 'BlackPast.org: Mississippi Freedom Democratic Party',
        },
      ],
      historicalContext:
        'Built through COFO\'s Freedom Vote and Freedom Summer infrastructure, the MFDP made Fannie Lou Hamer\'s testimony a national broadcast moment and helped set the stage for later Democratic Party reforms on delegate selection.',
      topicIds: ['civil-rights', 'voting-rights', 'politics'],
      mentionedEntityIds: [
        'ent_mfdp_dnc_challenge_001',
        'ent_fannie_lou_hamer_001',
        'ent_cofo_001',
        'ent_freedom_summer_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_mfdp_dnc_challenge_001', type: 'participated_in', direction: 'outgoing' },
        { id: 'ent_cofo_001', type: 'related_to', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_birmingham_campaign_001',
      kind: 'event',
      displayName: 'Birmingham Campaign',
      summary:
        'In spring 1963, SCLC and the Alabama Christian Movement for Human Rights led by Fred Shuttlesworth confronted Birmingham\'s segregation laws with mass marches, a downtown boycott, and the children\'s crusade — drawing national attention after police used dogs and fire hoses, and helping build momentum for the March on Washington and federal civil rights legislation.',
      eraBuckets: ['1960s'],
      topicTags: ['civil-rights', 'direct-action', 'nonviolence'],
      jurisdictionLabel: 'Birmingham, Alabama',
      locationPrecision: 'city',
      locationLabel: 'Kelly Ingram Park / 16th Street Baptist Church area, Birmingham',
      lat: 33.5165,
      lng: -86.8118,
      claims: [
        {
          predicate: 'launched_in',
          object:
            'April–May 1963 in Birmingham as Project C ("Confrontation"), coordinated by SCLC with local leadership from Fred Shuttlesworth\'s Alabama Christian Movement for Human Rights',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/birminghamcampaign.htm',
          citationLabel: 'National Park Service: Birmingham Campaign',
        },
        {
          predicate: 'drew_national_attention_when',
          object:
            'Birmingham police under Eugene "Bull" Connor used dogs and fire hoses against demonstrators, including children, images that circulated nationwide in May 1963',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/birminghamcampaign.htm',
          citationLabel: 'National Park Service: Birmingham Campaign',
        },
      ],
      historicalContext:
        'King\'s "Letter from Birmingham Jail," written during his April arrest, and the children\'s marches from 16th Street Baptist Church made Birmingham a turning point. The A.G. Gaston Motel served as SCLC headquarters; Kelly Ingram Park was the street-level stage.',
      topicIds: ['civil-rights', 'direct-action', 'nonviolence'],
      mentionedEntityIds: [
        'ent_sclc_001',
        'ent_fred_shuttlesworth_001',
        'ent_martin_luther_king_jr_001',
        'ent_gaston_motel_001',
        'ent_kelly_ingram_park_001',
        'ent_birmingham_civil_rights_institute_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_sclc_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_gaston_motel_001', type: 'occurred_at', direction: 'outgoing' },
        { id: 'ent_kelly_ingram_park_001', type: 'occurred_at', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_freedom_rides_001',
      kind: 'event',
      displayName: 'Freedom Rides (1961)',
      summary:
        'Beginning in May 1961, interracial teams organized by CORE — soon joined by SNCC and others — rode interstate buses through the South to enforce Supreme Court bans on segregated travel, facing mob violence in Alabama and filling Mississippi jails, until the Interstate Commerce Commission ordered desegregation of bus terminals.',
      eraBuckets: ['1960s'],
      topicTags: ['civil-rights', 'direct-action', 'nonviolence'],
      jurisdictionLabel: 'Montgomery, Alabama',
      locationPrecision: 'institution',
      locationLabel: 'Montgomery Greyhound Station (Freedom Rides Museum)',
      lat: 32.3765,
      lng: -86.3087,
      claims: [
        {
          predicate: 'began_in',
          object:
            'May 1961 when CORE launched interracial Freedom Ride teams from Washington, D.C., into the Deep South to test Boynton v. Virginia and related interstate travel rulings',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/freedomrides.htm',
          citationLabel: 'National Park Service: Freedom Rides',
        },
        {
          predicate: 'met_violence_in',
          object:
            'Anniston, Birmingham, and Montgomery, Alabama, where riders were beaten and buses attacked before continuing into Mississippi under federal and movement pressure',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/freedomrides.htm',
          citationLabel: 'National Park Service: Freedom Rides',
        },
      ],
      historicalContext:
        'The rides forced a federal response and trained a generation of organizers who later staffed SNCC and COFO projects. The Montgomery Greyhound station is now the Freedom Rides Museum.',
      topicIds: ['civil-rights', 'direct-action', 'nonviolence'],
      mentionedEntityIds: [
        'ent_core_001',
        'ent_sncc_001',
        'ent_freedom_rides_museum_001',
        'ent_diane_nash_001',
        'ent_john_lewis_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_core_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_freedom_rides_museum_001', type: 'occurred_at', direction: 'outgoing' },
        { id: 'ent_sncc_001', type: 'related_to', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_freedom_summer_001',
      kind: 'event',
      displayName: 'Freedom Summer (1964)',
      summary:
        'In 1964, COFO brought roughly a thousand volunteers — many northern students — into Mississippi for a statewide voter-registration, Freedom School, and MFDP organizing project. The season was marked by the murders of Chaney, Goodman, and Schwerner and by the MFDP\'s challenge at the Democratic National Convention.',
      eraBuckets: ['1960s'],
      topicTags: ['civil-rights', 'voting-rights', 'organizing'],
      jurisdictionLabel: 'Jackson, Mississippi',
      locationPrecision: 'city',
      locationLabel: 'Jackson, Mississippi (COFO statewide headquarters)',
      lat: 32.2988,
      lng: -90.1848,
      claims: [
        {
          predicate: 'organized_by',
          object:
            'the Council of Federated Organizations (COFO) in summer 1964 as a statewide Mississippi project combining voter registration, Freedom Schools, and the Mississippi Freedom Democratic Party',
          confidenceLevel: 'high',
          citationSource: 'snccdigital.org',
          citationHref: 'https://snccdigital.org/events/freedom-summer/',
          citationLabel: 'SNCC Digital Gateway: Freedom Summer',
        },
        {
          predicate: 'drew_national_attention_after',
          object:
            'the June 1964 murders of James Chaney, Andrew Goodman, and Michael Schwerner near Philadelphia, Mississippi, during the project\'s opening weeks',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/articles/freedomsummer.htm',
          citationLabel: 'National Park Service: Freedom Summer',
        },
      ],
      historicalContext:
        'Freedom Summer grew from the 1963 Freedom Vote and Bob Moses\'s SNCC Mississippi work. Local Black leadership remained central even as national media focused on white volunteers; the MFDP challenge carried the season\'s political demand to Atlantic City.',
      topicIds: ['civil-rights', 'voting-rights', 'organizing'],
      mentionedEntityIds: [
        'ent_cofo_001',
        'ent_robert_moses_001',
        'ent_mfdp_001',
        'ent_freedom_summer_mount_zion_001',
        'ent_sncc_001',
      ],
      keywords: [],
      related: [
        { id: 'ent_cofo_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_freedom_summer_mount_zion_001', type: 'related_to', direction: 'outgoing' },
        { id: 'ent_mfdp_001', type: 'related_to', direction: 'outgoing' },
      ],
    },
  },
  {
    file: 'civil-rights-movements-leaders.json',
    entity: {
      id: 'ent_little_rock_nine_001',
      kind: 'movement',
      displayName: 'Little Rock Nine',
      summary:
        'Nine Black students who, with NAACP support led locally by Daisy Bates, entered Little Rock Central High School in September 1957 under federal troop escort after Arkansas officials blocked desegregation — becoming the emblematic test of Brown v. Board in the South.',
      eraBuckets: ['1950s'],
      topicTags: ['civil-rights', 'education', 'desegregation'],
      jurisdictionLabel: 'Little Rock, Arkansas',
      locationPrecision: 'campus',
      locationLabel: 'Little Rock Central High School, Little Rock',
      lat: 34.7368,
      lng: -92.2982,
      claims: [
        {
          predicate: 'entered',
          object:
            'Little Rock Central High School on September 25, 1957, under escort of the 101st Airborne after President Eisenhower federalized the Arkansas National Guard',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/chsc/learn/historyculture/index.htm',
          citationLabel: 'National Park Service: Little Rock Central High School NHS',
        },
        {
          predicate: 'supported_by',
          object:
            'the Arkansas NAACP and Daisy Bates, who mentored the students through the 1957–58 school year of harassment and state resistance',
          confidenceLevel: 'high',
          citationSource: 'nps.gov',
          citationHref: 'https://www.nps.gov/people/daisy-bates.htm',
          citationLabel: 'National Park Service: Daisy Bates',
        },
      ],
      historicalContext:
        'The crisis made Little Rock a worldwide symbol of massive resistance. The students\' endurance, Bates\'s organizing, and federal enforcement together defined a pivotal early implementation fight after Brown.',
      topicIds: ['civil-rights', 'education', 'desegregation'],
      mentionedEntityIds: [
        'ent_daisy_bates_001',
        'ent_little_rock_central_high_school_001',
        'ent_little_rock_school_desegregation_crisis_001',
        'ent_naacp_001',
      ],
      keywords: [],
      related: [
        {
          id: 'ent_little_rock_school_desegregation_crisis_001',
          type: 'related_to',
          direction: 'outgoing',
        },
        { id: 'ent_little_rock_central_high_school_001', type: 'located_at', direction: 'outgoing' },
        { id: 'ent_daisy_bates_001', type: 'related_to', direction: 'outgoing' },
      ],
    },
  },
];

function loadCatalog(): { files: Map<string, CatalogEntity[]>; byId: Map<string, CatalogEntity> } {
  const files = new Map<string, CatalogEntity[]>();
  const byId = new Map<string, CatalogEntity>();
  for (const full of walkJsonFiles(CATALOG_DIR)) {
    const raw = JSON.parse(readFileSync(full, 'utf8')) as unknown;
    if (!Array.isArray(raw)) continue;
    const rel = relative(CATALOG_DIR, full);
    const entities = raw as CatalogEntity[];
    files.set(rel, entities);
    for (const e of entities) {
      if (e?.id) byId.set(e.id, e);
    }
  }
  return { files, byId };
}

function main(): void {
  const { files, byId } = loadCatalog();

  // 1. Insert new entities
  let created = 0;
  for (const { file, entity } of NEW_ENTITIES) {
    if (byId.has(entity.id)) {
      console.log(`skip create (exists): ${entity.id}`);
      continue;
    }
    const list = files.get(file);
    if (!list) throw new Error(`Missing catalog file ${file}`);
    list.push(entity);
    byId.set(entity.id, entity);
    created += 1;
    console.log(`created ${entity.id} in ${file}`);
  }

  // 2. Remap slug mentions (do not yet wire every mention — that floods hub adjacency caps).
  let remapped = 0;
  let edgesAdded = 0;
  const mosaicCredits = readFileSync(
    join(ROOT, 'apps/web/src/components/atmosphere/tile-credits.ts'),
    'utf8',
  );
  const mosaicIds = new Set(
    [...mosaicCredits.matchAll(/entityId:\s*'([^']+)'/g)].map((m) => m[1]!),
  );
  const slugTargets = new Set(Object.values(SLUG_TO_ENTITY_ID));

  for (const entity of byId.values()) {
    const mentions = entity.mentionedEntityIds ?? [];
    if (mentions.length === 0) continue;

    const nextMentions: string[] = [];
    const seen = new Set<string>();
    for (const raw of mentions) {
      const mapped = SLUG_TO_ENTITY_ID[raw] ?? raw;
      if (mapped !== raw) remapped += 1;
      if (mapped === entity.id) continue;
      if (seen.has(mapped)) continue;
      seen.add(mapped);
      nextMentions.push(mapped);
    }
    entity.mentionedEntityIds = nextMentions;
  }

  // 3. Surgical related[] wiring:
  //    - edges for remapped slug targets (orgs/campaigns we just made real)
  //    - mosaic people → all their mentions (about-page click-throughs)
  //    - founding ↔ org
  // Avoid wiring every catalog mention: hubs exceed DEFAULT_ADJACENCY_CAP (25) and drop
  // critical edges (e.g. MLK → SCLC).
  for (const entity of byId.values()) {
    for (const mid of entity.mentionedEntityIds ?? []) {
      if (!slugTargets.has(mid)) continue;
      const target = byId.get(mid);
      if (!target) {
        console.warn(`dangling mention after remap: ${entity.id} → ${mid}`);
        continue;
      }
      const rel = inferRelation(entity.kind, target.kind);
      const before = entity.related?.length ?? 0;
      addRelated(entity, { id: mid, type: rel.type, direction: rel.direction });
      if ((entity.related?.length ?? 0) > before) edgesAdded += 1;
    }
  }

  for (const id of mosaicIds) {
    const entity = byId.get(id);
    if (!entity || entity.kind !== 'person') continue;
    for (const mid of entity.mentionedEntityIds ?? []) {
      const target = byId.get(mid);
      if (!target) continue;
      const rel = inferRelation(entity.kind, target.kind);
      const before = entity.related?.length ?? 0;
      addRelated(entity, { id: mid, type: rel.type, direction: rel.direction });
      if ((entity.related?.length ?? 0) > before) edgesAdded += 1;
    }
  }

  for (const { foundingId, orgId } of FOUNDING_TO_ORG) {
    const founding = byId.get(foundingId);
    const org = byId.get(orgId);
    if (!founding || !org) {
      console.warn(`missing founding/org pair ${foundingId} / ${orgId}`);
      continue;
    }
    addRelated(founding, { id: orgId, type: 'related_to', direction: 'outgoing' });
    addRelated(org, { id: foundingId, type: 'related_to', direction: 'outgoing' });
  }

  // New org/event records should not related_to every mentioned person (incoming flood on hubs).
  for (const id of NEW_ENTITIES.map((n) => n.entity.id)) {
    const entity = byId.get(id);
    if (!entity?.related) continue;
    entity.related = entity.related.filter((r) => {
      const neighbor = byId.get(r.id);
      return !(neighbor?.kind === 'person' && r.type === 'related_to');
    });
  }

  // 4. Write changed files
  for (const [rel, entities] of files) {
    writeFileSync(join(CATALOG_DIR, rel), `${JSON.stringify(entities, null, 2)}\n`, 'utf8');
  }

  // 5. Validate
  const slugLeft: string[] = [];
  const danglingMentions: string[] = [];
  const danglingRelated: string[] = [];
  for (const entity of byId.values()) {
    for (const m of entity.mentionedEntityIds ?? []) {
      if (!m.startsWith('ent_')) slugLeft.push(`${entity.id}→${m}`);
      else if (!byId.has(m)) danglingMentions.push(`${entity.id}→${m}`);
    }
    for (const r of entity.related ?? []) {
      if (!byId.has(r.id)) danglingRelated.push(`${entity.id}→${r.id}`);
    }
  }

  const extracted = extractCatalogRelationships(
    [...byId.values()].map((e) => ({
      id: e.id,
      claims: e.claims as never,
      related: e.related as never,
    })),
    { generatedAt: new Date().toISOString() },
  );

  const mosaicPeopleWithMentionsAndRelated = [...mosaicIds].filter((id) => {
    const e = byId.get(id);
    return (
      e?.kind === 'person' &&
      (e.mentionedEntityIds?.length ?? 0) > 0 &&
      (e.related?.length ?? 0) > 0
    );
  });
  const mosaicPeopleWithMentionsMissingRelated = [...mosaicIds].filter((id) => {
    const e = byId.get(id);
    return (
      e?.kind === 'person' &&
      (e.mentionedEntityIds?.length ?? 0) > 0 &&
      (e.related?.length ?? 0) === 0
    );
  });

  const mlk = byId.get('ent_martin_luther_king_jr_001');
  const mlkHasSclc = (mlk?.related ?? []).some(
    (r) => r.id === 'ent_sclc_001' && r.type === 'member_of',
  );
  console.log('\n=== Summary ===');
  console.log(`created: ${created}`);
  console.log(`slug remaps applied: ${remapped}`);
  console.log(`related edges added (approx): ${edgesAdded}`);
  console.log(`catalog size: ${byId.size}`);
  console.log(`extractCatalogRelationships: ${extracted.relationships.length} edges, ${extracted.skipped.length} skipped`);
  if (extracted.skipped.length) {
    console.log('skipped sample:', extracted.skipped.slice(0, 15));
  }
  console.log(`slug leftovers: ${slugLeft.length}`);
  console.log(`dangling mentions: ${danglingMentions.length}`);
  console.log(`dangling related: ${danglingRelated.length}`);
  console.log(
    `mosaic people with mentions+related: ${mosaicPeopleWithMentionsAndRelated.length}; missing related: ${mosaicPeopleWithMentionsMissingRelated.length}`,
  );
  console.log(`MLK member_of SCLC: ${mlkHasSclc}`);
  if (slugLeft.length || danglingMentions.length || danglingRelated.length) {
    console.error({ slugLeft, danglingMentions, danglingRelated });
    process.exit(1);
  }
  if (mosaicPeopleWithMentionsMissingRelated.length) {
    console.error('mosaic people still missing related:', mosaicPeopleWithMentionsMissingRelated);
    process.exit(1);
  }
  if (!mlkHasSclc) {
    console.error('MLK is missing member_of → ent_sclc_001');
    process.exit(1);
  }
  console.log('OK');
}

main();
