/**
 * Myths and misconceptions index pre-bunking reviews of circulating third-party claims.
 * ClaimReview JSON-LD is emitted only on individual myth pages under /myths/[slug].
 */
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
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.myths} pageTitle="Myths" />
      <p className="ds-page__eyebrow">Pre-bunking</p>
      <h1 className="ds-page__title">Myths &amp; misconceptions</h1>
      <p className="ds-page__lede">
        These pages review genuinely circulating third-party claims — educational, non-judgmental,
        and focused on techniques you can verify yourself. Canonical fact records live on{' '}
        <a href="/facts">/facts</a>; only this surface emits ClaimReview markup.
      </p>

      <ul className="ds-sans" style={{ marginTop: 'var(--ds-space-8)', paddingLeft: 'var(--ds-space-5)' }}>
        {reviews.map((review) => (
          <li key={review.slug} style={{ marginBottom: 'var(--ds-space-4)' }}>
            <a href={review.pageUrl}>{review.title}</a>
            <p style={{ margin: 'var(--ds-space-1) 0 0 0', color: 'var(--ds-ink-muted)' }}>
              Technique: {review.technique}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
