/**
 * Circulating third-party claim reviews for the /myths surface (BB-088) — the ONLY pages that
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
    slug: 'rosa-parks-was-just-tired',
    title: '“Rosa Parks was just tired that day”',
    technique: 'Quoting a source out of context',
    pageUrl: '/myths/rosa-parks-was-just-tired',
    datePublished: '2026-07-17',
    claimReviewed:
      'Rosa Parks refused to give up her bus seat because she was physically tired, not as a deliberate act of protest.',
    reviewBody:
      'Contemporaneous arrest records and Parks\u2019s own documented activism show a deliberate act tied to organized nonviolent resistance training, not spontaneous fatigue.',
    claimOrigin: {
      name: 'Circulating social post',
      url: 'https://example.com/social/rosa-parks-tired',
    },
    ratingExplanation: 'Misleading — omits documented prior activism',
    authorName: 'Black Book',
    relatedFactUrl: '/facts/BB-F-000001/rosa-parks-arrested-december-1-1955',
  },
  {
    slug: 'founding-attendance-was-3000',
    title: '“The institution had 3,000 founding members”',
    technique: 'Treating a single uncited retrospective as authoritative',
    pageUrl: '/myths/founding-attendance-was-3000',
    datePublished: '2026-07-17',
    claimReviewed:
      'A local institution welcomed 3,000 members at its founding, based on a 1980s newspaper retrospective.',
    reviewBody:
      'The retrospective cites no primary source. The institution\u2019s own 1975 membership rolls document approximately 1,200 members — the figure this archive publishes with the contradicting source disclosed.',
    claimOrigin: {
      name: '1980s newspaper retrospective',
      url: 'https://example-news.example/retrospective-1980s',
    },
    ratingExplanation: 'False — contradicted by primary membership rolls',
    authorName: 'Black Book',
    relatedFactUrl: '/facts/BB-F-000003/institution-attendance-figure-corrected',
  },
];

export function listMythReviews(): readonly MythReview[] {
  return MYTH_REVIEWS;
}

export function getMythReview(slug: string): MythReview | undefined {
  return MYTH_REVIEWS.find((review) => review.slug === slug);
}
