/**
 * Circulating third-party claim reviews for the /myths surface the ONLY pages that
 * emit schema.org ClaimReview markup. Each review addresses one externally attributed claim.
 */
import type { MythClaimReviewInput } from './domain-trust.js';

export type MythReview = MythClaimReviewInput & {
  readonly slug: string;
  readonly title: string;
  readonly technique: string;
  readonly relatedFactUrl?: string;
};

export const MYTH_REVIEWS: readonly MythReview[] = [
  {
    slug: 'dunbar-always-called-dunbar',
    title: '“Dunbar has always been called Dunbar High School”',
    technique: 'Collapsing a multi-name institutional history into its best-known name',
    pageUrl: '/myths/dunbar-always-called-dunbar',
    datePublished: '2026-07-17',
    claimReviewed:
      'The school now known as Paul Laurence Dunbar High School has always been called Dunbar High School.',
    reviewBody:
      'The school operated under two earlier names before the 1916 renaming: Preparatory High ' +
      'School for Colored Youth (1870–1891) and M Street High School (1891–1916). It became Paul ' +
      'Laurence Dunbar High School only in 1916, when it moved to a new building named for the poet.',
    claimOrigin: {
      name: 'Common assumption about the school’s naming history',
    },
    ratingExplanation: 'False — the school carried two earlier names before 1916',
    authorName: 'Blap',
    relatedFactUrl: '/facts/BB-F-000003/renamed-paul-laurence-dunbar-1916',
  },
  {
    slug: 'todays-building-is-the-1916-building',
    title: '“The Dunbar building alumni visit today is the historic 1916 building”',
    technique: 'Assuming a landmark institution’s current building is its original structure',
    pageUrl: '/myths/todays-building-is-the-1916-building',
    datePublished: '2026-07-17',
    claimReviewed:
      'The Paul Laurence Dunbar High School building students and alumni visit today is the original 1916 building.',
    reviewBody:
      'The 1916 building was demolished in 1977; its 1970s replacement was itself demolished in ' +
      '2013. The current building, opened in 2013, sits on the same footprint and honors the ' +
      'school’s history through graduate plaques and paintings of alumni who appeared on U.S. ' +
      'postage stamps, but it is a new structure, not the historic 1916 building.',
    claimOrigin: {
      name: 'Common assumption about the current building’s history',
    },
    ratingExplanation: 'False — the 1916 building and its 1970s replacement were both demolished',
    authorName: 'Blap',
    relatedFactUrl: '/facts/BB-F-000005/1916-and-1970s-buildings-demolished-rebuilt-2013',
  },
];

export function listMythReviews(): readonly MythReview[] {
  return MYTH_REVIEWS;
}

export function getMythReview(slug: string): MythReview | undefined {
  return MYTH_REVIEWS.find((review) => review.slug === slug);
}
