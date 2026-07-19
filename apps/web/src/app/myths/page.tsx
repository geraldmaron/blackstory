/**
 * Myths and misconceptions index — pre-bunking reviews of circulating third-party claims.
 * ClaimReview JSON-LD is emitted only on individual myth pages under /myths/[slug].
 */
import Link from 'next/link';
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { listMythReviews } from '../../lib/trust/myths-seed';
import { TRUST_PATHS } from '../../lib/trust/site-identity';

export const metadata = {
  title: 'Myths & misconceptions',
  description:
    'Reviews of commonly circulating claims about Black history — technique-based refutations with primary-source links.',
};

export default function MythsIndexPage() {
  const reviews = listMythReviews();

  return (
    <main className="ds-container ds-page" id="main">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.myths} pageTitle="Myths & misconceptions" />
      <p className="ds-page__eyebrow">Pre-bunking</p>
      <h1 className="ds-page__title">Myths &amp; misconceptions</h1>
      <p className="ds-page__lede">
        A library of circulating third-party claims, reviewed technique by technique — educational,
        non-judgmental, and checkable. Short citable pins live in{' '}
        <Link href="/facts">Quick facts</Link>; only this surface emits ClaimReview markup.
      </p>

      <section className="ds-section ds-section--flush" aria-label="Myth reviews">
        <ul className="ds-story-rail">
          {reviews.map((review) => (
            <li key={review.slug}>
              <Link className="ds-story-link" href={review.pageUrl}>
                <span className="ds-story-link__meta">Technique · {review.technique}</span>
                <h2 className="ds-story-link__title">{review.title}</h2>
                <p className="ds-story-link__summary">{review.ratingExplanation}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
