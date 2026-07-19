/**
 * Controlled historical-theme taxonomy (the related workstream).
 *
 * This registry is the ONLY vocabulary that may ever be surfaced as a facet/filter option.
 * It replaces the interim `TOPIC_TAG_ALLOWLIST` (packages/domain/src/search/topic-allowlist.ts,
 * the related workstream) as the source of truth for what counts as a legitimate "theme". The allowlist
 * remains in place for backward compatibility (see that file's updated header) but new code
 * should read from here.
 *
 * Design: a flat, versioned list of `{ id, label }` pairs. `id` is a stable, kebab-case
 * identifier safe to persist (Firestore field values, URL query params); `label` is the
 * human-readable display string. Bump `TOPIC_TAXONOMY_SCHEMA_VERSION` whenever an id is renamed
 * or removed (additions alone don't require a bump — readers should treat unknown ids as
 * "not a taxonomy member" rather than erroring).
 *
 * Seeded 1:1 from the ~195 entries the prior interim allowlist had already vetted as
 * legitimate themes (not person/org/event/law names) MINUS 14 entries this pass reclassifies:
 *
 * - Organization acronyms (`cofo`, `core`, `mfdp`, `naacp`, `sclc`, `sncc`): these name a
 *   specific organization, which is what `mentionedEntityIds` is for, not a theme.
 * - Named single events/campaigns/laws (`birmingham-campaign`, `civil-rights-act-1866`,
 *   `freedom-rides`, `freedom-summer`, `little-rock-nine`, `march-on-washington`,
 *   `montgomery-bus-boycott`, `selma`): each names one specific historical event, group, or
 *   statute rather than a recurring theme — that's `mentionedEntityIds` territory too (an event
 *   or law is a resolvable "thing", not a browsable category). Generic period/policy concepts
 *   that are NOT tied to one dated event (`jim-crow`, `black-codes`, `fugitive-slave-law`,
 *   `great-migration`, `harlem-renaissance`, etc.) stay as themes since they describe a
 *   recurring pattern across many records, not a single occurrence.
 *
 * See `packages/domain/src/taxonomy/split-topic-tags.ts` for the migration logic that routes
 * legacy `topicTags` values into `topicIds` / `mentionedEntityIds` / `keywords` using this
 * registry plus the excluded-tag lists above.
 */

export const TOPIC_TAXONOMY_SCHEMA_VERSION = 1;

export type TopicDefinition = {
  readonly id: string;
  readonly label: string;
  readonly schemaVersion: number;
};

const RAW_TOPIC_ENTRIES: ReadonlyArray<{ readonly id: string; readonly label: string }> = [
  { id: 'abolition', label: 'Abolition' },
  { id: 'affirmative-action', label: 'Affirmative Action' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'air-force', label: 'Air Force' },
  { id: 'anti-miscegenation', label: 'Anti-Miscegenation' },
  { id: 'army', label: 'Army' },
  { id: 'archive', label: 'Archive' },
  { id: 'archives', label: 'Archives' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'art', label: 'Art' },
  { id: 'arts', label: 'Arts' },
  { id: 'assassination', label: 'Assassination' },
  { id: 'aviation', label: 'Aviation' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'banking', label: 'Banking' },
  { id: 'baseball', label: 'Baseball' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'ballroom', label: 'Ballroom' },
  { id: 'biology', label: 'Biology' },
  { id: 'blues', label: 'Blues' },
  { id: 'birthplace', label: 'Birthplace' },
  { id: 'black-architects', label: 'Black Architects' },
  { id: 'black-codes', label: 'Black Codes' },
  { id: 'black-nationalism', label: 'Black Nationalism' },
  { id: 'black-power', label: 'Black Power' },
  { id: 'bobsled', label: 'Bobsled' },
  { id: 'boxing', label: 'Boxing' },
  { id: 'boyhood-home', label: 'Boyhood Home' },
  { id: 'business', label: 'Business' },
  { id: 'burial-ground', label: 'Burial Ground' },
  { id: 'busing', label: 'Busing' },
  { id: 'cabinet', label: 'Cabinet' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'cemetery', label: 'Cemetery' },
  { id: 'childhood', label: 'Childhood' },
  { id: 'church', label: 'Church' },
  { id: 'citizenship', label: 'Citizenship' },
  { id: 'citizenship-schools', label: 'Citizenship Schools' },
  { id: 'civil-rights', label: 'Civil Rights' },
  { id: 'civil-war', label: 'Civil War' },
  { id: 'coalition', label: 'Coalition' },
  { id: 'commemoration', label: 'Commemoration' },
  { id: 'commerce-clause', label: 'Commerce Clause' },
  { id: 'community', label: 'Community' },
  { id: 'community-organizing', label: 'Community Organizing' },
  { id: 'community-programs', label: 'Community Programs' },
  { id: 'constitutional-law', label: 'Constitutional Law' },
  { id: 'cooperatives', label: 'Cooperatives' },
  { id: 'criminal-justice', label: 'Criminal Justice' },
  { id: 'craft', label: 'Craft' },
  { id: 'culture', label: 'Culture' },
  { id: 'dance', label: 'Dance' },
  { id: 'denomination-founding', label: 'Denomination Founding' },
  { id: 'desegregation', label: 'Desegregation' },
  { id: 'debate', label: 'Debate' },
  { id: 'diplomacy', label: 'Diplomacy' },
  { id: 'domestic-work', label: 'Domestic Work' },
  { id: 'direct-action', label: 'Direct Action' },
  { id: 'disparate-impact', label: 'Disparate Impact' },
  { id: 'district', label: 'District' },
  { id: 'due-process', label: 'Due Process' },
  { id: 'economic-justice', label: 'Economic Justice' },
  { id: 'education', label: 'Education' },
  { id: 'emancipation', label: 'Emancipation' },
  { id: 'employment', label: 'Employment' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'enslavement', label: 'Enslavement' },
  { id: 'entrepreneurship', label: 'Entrepreneurship' },
  { id: 'equal-protection', label: 'Equal Protection' },
  { id: 'eugenics', label: 'Eugenics' },
  { id: 'fair-housing', label: 'Fair Housing' },
  { id: 'federal-intervention', label: 'Federal Intervention' },
  { id: 'figure-skating', label: 'Figure Skating' },
  { id: 'film', label: 'Film' },
  { id: 'finance', label: 'Finance' },
  { id: 'first-amendment', label: 'First Amendment' },
  { id: 'firsts', label: 'Firsts' },
  { id: 'football', label: 'Football' },
  { id: 'founding-era', label: 'Founding Era' },
  { id: 'frontier', label: 'Frontier' },
  { id: 'free-people-of-color', label: 'Free People of Color' },
  { id: 'freedom', label: 'Freedom' },
  { id: 'fugitive-slave-law', label: 'Fugitive Slave Law' },
  { id: 'genealogy', label: 'Genealogy' },
  { id: 'gerrymandering', label: 'Gerrymandering' },
  { id: 'golf', label: 'Golf' },
  { id: 'government', label: 'Government' },
  { id: 'governors', label: 'Governors' },
  { id: 'grassroots-leadership', label: 'Grassroots Leadership' },
  { id: 'great-migration', label: 'Great Migration' },
  { id: 'greenwood', label: 'Greenwood' },
  { id: 'gymnastics', label: 'Gymnastics' },
  { id: 'hall-of-fame', label: 'Hall of Fame' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'harlem', label: 'Harlem' },
  { id: 'harlem-renaissance', label: 'Harlem Renaissance' },
  { id: 'hbcu', label: 'HBCUs' },
  { id: 'higher-education', label: 'Higher Education' },
  { id: 'history', label: 'History' },
  { id: 'hockey', label: 'Hockey' },
  { id: 'house-of-representatives', label: 'House of Representatives' },
  { id: 'housing', label: 'Housing' },
  { id: 'interstate-travel', label: 'Interstate Travel' },
  { id: 'invention', label: 'Invention' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'jim-crow', label: 'Jim Crow' },
  { id: 'journalism', label: 'Journalism' },
  { id: 'judiciary', label: 'Judiciary' },
  { id: 'jury-selection', label: 'Jury Selection' },
  { id: 'labor', label: 'Labor' },
  { id: 'land-ownership', label: 'Land Ownership' },
  { id: 'land-grant', label: 'Land Grant' },
  { id: 'law', label: 'Law' },
  { id: 'law-enforcement', label: 'Law Enforcement' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'liberal-arts', label: 'Liberal Arts' },
  { id: 'library', label: 'Library' },
  { id: 'literature', label: 'Literature' },
  { id: 'marine-corps', label: 'Marine Corps' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'maritime', label: 'Maritime' },
  { id: 'mass-mobilization', label: 'Mass Mobilization' },
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'mayors', label: 'Mayors' },
  { id: 'media', label: 'Media' },
  { id: 'medicine', label: 'Medicine' },
  { id: 'memorial', label: 'Memorial' },
  { id: 'memory', label: 'Memory' },
  { id: 'migration', label: 'Migration' },
  { id: 'military', label: 'Military' },
  { id: 'movement', label: 'Movement' },
  { id: 'movement-churches', label: 'Movement Churches' },
  { id: 'museum', label: 'Museum' },
  { id: 'music', label: 'Music' },
  { id: 'nation-of-islam', label: 'Nation of Islam' },
  { id: 'national-capital', label: 'National Capital' },
  { id: 'national-mall', label: 'National Mall' },
  { id: 'navy', label: 'Navy' },
  { id: 'nonviolence', label: 'Nonviolence' },
  { id: 'northern-movement', label: 'Northern Movement' },
  { id: 'olympics', label: 'Olympics' },
  { id: 'opera', label: 'Opera' },
  { id: 'organizing', label: 'Organizing' },
  { id: 'organizing-schools', label: 'Organizing Schools' },
  { id: 'pan-africanism', label: 'Pan Africanism' },
  { id: 'peonage', label: 'Peonage' },
  { id: 'philanthropy', label: 'Philanthropy' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'photography', label: 'Photography' },
  { id: 'physics', label: 'Physics' },
  { id: 'police-violence', label: 'Police Violence' },
  { id: 'politics', label: 'Politics' },
  { id: 'poverty', label: 'Poverty' },
  { id: 'preservation', label: 'Preservation' },
  { id: 'press', label: 'Press' },
  { id: 'president', label: 'President' },
  { id: 'property-ownership', label: 'Property Ownership' },
  { id: 'public-accommodations', label: 'Public Accommodations' },
  { id: 'public-safety', label: 'Public Safety' },
  { id: 'public-transit', label: 'Public Transit' },
  { id: 'publication', label: 'Publication' },
  { id: 'publishing', label: 'Publishing' },
  { id: 'railroad', label: 'Railroad' },
  { id: 'rebellion', label: 'Rebellion' },
  { id: 'reconstruction', label: 'Reconstruction' },
  { id: 'religion', label: 'Religion' },
  { id: 'research', label: 'Research' },
  { id: 'resilience', label: 'Resilience' },
  { id: 'resistance', label: 'Resistance' },
  { id: 'restrictive-covenants', label: 'Restrictive Covenants' },
  { id: 'right-to-counsel', label: 'Right to Counsel' },
  { id: 'school-desegregation', label: 'School Desegregation' },
  { id: 'science', label: 'Science' },
  { id: 'sectionalism', label: 'Sectionalism' },
  { id: 'segregation', label: 'Segregation' },
  { id: 'self-defense', label: 'Self Defense' },
  { id: 'self-determination', label: 'Self Determination' },
  { id: 'self-governance', label: 'Self Governance' },
  { id: 'senate', label: 'Senate' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'sit-ins', label: 'Sit-Ins' },
  { id: 'space', label: 'Space' },
  { id: 'sports', label: 'Sports' },
  { id: 'student-activism', label: 'Student Activism' },
  { id: 'student-movement', label: 'Student Movement' },
  { id: 'supreme-court', label: 'Supreme Court' },
  { id: 'sweet-auburn', label: 'Sweet Auburn' },
  { id: 'teaching', label: 'Teaching' },
  { id: 'technology', label: 'Technology' },
  { id: 'television', label: 'Television' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'theater', label: 'Theater' },
  { id: 'town', label: 'Town' },
  { id: 'track-and-field', label: 'Track and Field' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'treme', label: 'Treme' },
  { id: 'underground-railroad', label: 'Underground Railroad' },
  { id: 'unions', label: 'Unions' },
  { id: 'vice-president', label: 'Vice President' },
  { id: 'voting-rights', label: 'Voting Rights' },
  { id: 'women', label: 'Women' },
  { id: 'women-leaders', label: 'Women Leaders' },
  { id: 'womens-education', label: "Women's Education" },
  { id: 'workers-rights', label: 'Workers Rights' },
  { id: 'youth-organizing', label: 'Youth Organizing' },
];

export const TOPIC_REGISTRY: readonly TopicDefinition[] = RAW_TOPIC_ENTRIES.map((entry) => ({
  ...entry,
  schemaVersion: TOPIC_TAXONOMY_SCHEMA_VERSION,
}));

export const TOPIC_REGISTRY_BY_ID: ReadonlyMap<string, TopicDefinition> = new Map(
  TOPIC_REGISTRY.map((topic) => [topic.id, topic]),
);

const TOPIC_IDS = new Set(TOPIC_REGISTRY.map((topic) => topic.id));

/** True when `id` is a member of the controlled topic taxonomy above. */
export function isValidTopicId(id: string): boolean {
  return TOPIC_IDS.has(id);
}

/** Display label for a topic id, or undefined when the id isn't in the registry. */
export function getTopicLabel(id: string): string | undefined {
  return TOPIC_REGISTRY_BY_ID.get(id)?.label;
}

/**
 * Legacy `topicTags` values that look like an organization acronym rather than a theme.
 * Used by the migration in `split-topic-tags.ts` to route these into `mentionedEntityIds`
 * as raw string placeholder ids. Real resolution against canonical entity ids is
 * the related workstream's job — this only prevents them from being mis-filed as topics.
 */
export const ORGANIZATION_SHAPED_LEGACY_TAGS: ReadonlySet<string> = new Set([
  'cofo',
  'core',
  'mfdp',
  'naacp',
  'sclc',
  'sncc',
]);

/**
 * Legacy `topicTags` values that name one specific event, campaign, group, or law rather than a
 * recurring theme. Used by the migration in `split-topic-tags.ts` to route these into
 * `mentionedEntityIds` as raw string placeholder ids (same caveat as above: no real
 * entity-resolution here, that's the related workstream).
 */
export const EVENT_OR_LAW_SHAPED_LEGACY_TAGS: ReadonlySet<string> = new Set([
  'birmingham-campaign',
  'civil-rights-act-1866',
  'freedom-rides',
  'freedom-summer',
  'little-rock-nine',
  'march-on-washington',
  'montgomery-bus-boycott',
  'selma',
]);
