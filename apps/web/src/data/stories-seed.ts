/**
 * Seed catalog of longform history Stories for `/stories`.
 *
 * Stands in for a published editorial projection the same way `facts-seed.ts` stands in for the
 * fact registry. Each story is a narrative article pinned to place and evidence — related entity
 * and fact ids must resolve against the public seed catalogs so off-ramps stay honest.
 */
export type StorySection = {
  readonly heading?: string;
  readonly paragraphs: readonly string[];
};

export type StoryRecord = {
  readonly slug: string;
  readonly title: string;
  readonly dek: string;
  readonly publishedAt: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly body: readonly StorySection[];
  readonly relatedEntityIds: readonly string[];
  readonly relatedFactIds: readonly string[];
};

export const SEED_STORIES: readonly StoryRecord[] = [
  {
    slug: 'basement-to-m-street',
    title: 'From a church basement to M Street',
    dek:
      'How the Preparatory High School for Colored Youth began under Fifteenth Street Presbyterian ' +
      'and became the school Washington would later call Dunbar.',
    publishedAt: '2026-07-17',
    eraLabel: '1870–1891',
    placeLabel: 'Washington, D.C.',
    relatedEntityIds: ['ent_dunbar_school_001', 'ent_15th_st_church_001'],
    relatedFactIds: ['BB-F-000001', 'BB-F-000002'],
    body: [
      {
        paragraphs: [
          'In 1870, William Syphax and the Board of Trustees for Colored Schools opened a public high ' +
            'school for Black students in the basement of Fifteenth Street Presbyterian Church. Forty-five ' +
            'students and one teacher, Emma J. Hutchins, made a beginning that the country had not yet ' +
            'normalized: a public secondary school for Black youth, funded as a public trust.',
          'The church basement was not a metaphor. It was a room with a street address, a congregation ' +
            'above it, and a school day that had to share space with worship. The archive pins that ' +
            'founding to place first — not as nostalgia, but as a checkable coordinate in the capital’s ' +
            'educational geography.',
        ],
      },
      {
        heading: 'A name that moved with the school',
        paragraphs: [
          'By 1891 the school had outgrown the basement identity. Renamed M Street High School, it ' +
            'carried the same institutional thread under a street name that residents could find on a map. ' +
            'The later Dunbar name would arrive in 1916; the earlier names remain part of the record so ' +
            'readers do not collapse a multi-name history into its best-known label.',
        ],
      },
    ],
  },
  {
    slug: 'naming-dunbar-1916',
    title: 'Naming Dunbar in 1916',
    dek:
      'When M Street High School became Paul Laurence Dunbar High School, the rename marked a new ' +
      'building and a poet’s name — not the invention of the school itself.',
    publishedAt: '2026-07-17',
    eraLabel: '1916',
    placeLabel: 'Washington, D.C.',
    relatedEntityIds: ['ent_dunbar_school_001'],
    relatedFactIds: ['BB-F-000003'],
    body: [
      {
        paragraphs: [
          'In 1916 the school moved into a new building and took the name of Paul Laurence Dunbar. The ' +
            'rename is often remembered as if the institution appeared fully formed under that title. The ' +
            'primary record is clearer: two earlier names already sit on the timeline, and the 1916 moment ' +
            'is a renaming tied to a building, not a founding from nothing.',
          'That distinction matters for readers who meet the school only through its later fame. A ' +
            'story that starts in 1916 erases the basement years and the M Street chapter. BlackStory ' +
            'keeps the rename as a dated event with citations, then points back to the earlier pins.',
        ],
      },
    ],
  },
  {
    slug: 'same-footprint-new-walls',
    title: 'Same footprint, new walls',
    dek:
      'The Dunbar campus students visit today is not the 1916 building. Demolition and rebuild are ' +
      'part of the institutional story — and part of what visitors need to know before they arrive.',
    publishedAt: '2026-07-17',
    eraLabel: '1977–2013',
    placeLabel: 'Washington, D.C.',
    relatedEntityIds: ['ent_dunbar_school_001', 'ent_dc_landmark_listing_1975'],
    relatedFactIds: ['BB-F-000004', 'BB-F-000005'],
    body: [
      {
        paragraphs: [
          'Historic listing and living campus are not the same claim. The school’s place on the D.C. ' +
            'Inventory of Historic Sites in 1975 sits beside a later architectural reality: the 1916 ' +
            'building was demolished, its 1970s replacement was demolished, and the structure opened in ' +
            '2013 stands on the same footprint with a different fabric.',
          'For a visitor, that is the difference between expecting original brick and meeting a ' +
            'contemporary school that honors alumni in plaques and paintings. The story does not deny ' +
            'continuity of institution; it refuses to smuggle continuity of building into the name.',
        ],
      },
    ],
  },
  {
    slug: 'alumni-keep-the-thread',
    title: 'Alumni keep the thread',
    dek:
      'The Dunbar Alumni Federation organizes continuity when buildings change — a living institution ' +
      'beside the school’s public record.',
    publishedAt: '2026-07-17',
    eraLabel: '2002–',
    placeLabel: 'Washington, D.C.',
    relatedEntityIds: ['ent_dunbar_alumni_federation_001', 'ent_dunbar_school_001'],
    relatedFactIds: ['BB-F-000006'],
    body: [
      {
        paragraphs: [
          'When walls change, memory work often moves into organizations that are not the school ' +
            'building itself. The Dunbar Alumni Federation, organized in 2002, is one such thread: ' +
            'graduates holding relationships, events, and institutional memory across rebuild eras.',
          'On BlackStory the federation is its own record — linked to the school, dated, and open to ' +
            'the same evidence rules. It is not a substitute for the school page; it is a neighbor in ' +
            'the graph that explains how people stay attached when the campus fabric turns over.',
        ],
      },
    ],
  },
] as const;

export function listSeedStories(): readonly StoryRecord[] {
  return SEED_STORIES;
}

export function getSeedStory(slug: string): StoryRecord | undefined {
  return SEED_STORIES.find((story) => story.slug === slug);
}
