/**
 * Seed catalog of longform history Stories for `/stories`.
 *
 * National-story lane records plus place-first narrative off-ramps to published entities/facts.
 */
import { NATIONAL_STORY_RECORDS, type StoryRecord, type StorySection } from './national-story-seed/stories';

export type { StoryRecord, StorySection };

/** Fifteenth story: Hampton Institute founding as its own place-first chapter beside Emancipation Oak. */
const HAMPTON_INSTITUTE_STORY: StoryRecord = {
  slug: 'hampton-normal-on-the-peninsula',
  title: 'A normal school on the peninsula',
  dek:
    'In 1868 Hampton Normal and Agricultural Institute opened on the Virginia Peninsula — a ' +
    'teacher-training campus that grew from Fort Monroe’s contraband schools into a lasting HBCU.',
  publishedAt: '2026-07-19',
  eraLabel: '1868–',
  placeLabel: 'Hampton, Virginia',
  relatedEntityIds: ['ent_hampton_university_001', 'ent_emancipation_oak_001'],
  relatedFactIds: ['BB-F-000117', 'BB-F-000115'],
  body: [
    {
      paragraphs: [
        'Hampton’s founding is a campus claim first: land on the peninsula, a normal-and-agricultural ' +
          'curriculum, and a dated opening in 1868 under Brig. Gen. Samuel Chapman Armstrong with ' +
          'American Missionary Association support.',
        'The Emancipation Oak on the same grounds is an earlier pin — outdoor classes in 1861 and a ' +
          'proclamation reading in 1863. The institute is what made those lessons into a lasting school.',
      ],
    },
    {
      heading: 'Teachers for a region',
      paragraphs: [
        'Hampton trained teachers who carried literacy work across the South. Booker T. Washington’s ' +
          '1875 graduation is a named off-ramp on the alumni record, not a substitute for the campus ' +
          'founding date.',
        'BlackStory keeps the oak and the institute as neighboring pins so readers can check both ' +
          'without collapsing them into a single myth.',
      ],
    },
  ],
};

export const SEED_STORIES: readonly StoryRecord[] = [...NATIONAL_STORY_RECORDS, HAMPTON_INSTITUTE_STORY];

export function listSeedStories(): readonly StoryRecord[] {
  return SEED_STORIES;
}

export function getSeedStory(slug: string): StoryRecord | undefined {
  return SEED_STORIES.find((story) => story.slug === slug);
}
