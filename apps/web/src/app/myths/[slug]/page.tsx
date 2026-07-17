/**
 * Individual myth review page the ONLY pages that emit schema.org ClaimReview markup.
 */
import { notFound } from 'next/navigation';
import {
  HowToReadThisRecord,
  MythClaimReviewScript,
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../../components/trust/index.js';
import { getMythReview } from '../../../lib/trust/myths-seed.js';

type MythPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateMetadata({ params }: MythPageProps) {
  const { slug } = await params;
  const review = getMythReview(slug);
  if (!review) {
    return { title: 'Myth not found' };
  }
  return {
    title: review.title,
    description: review.reviewBody,
  };
}

export default async function MythReviewPage({ params }: MythPageProps) {
  const { slug } = await params;
  const review = getMythReview(slug);
  if (!review) {
    notFound();
  }

  const pagePath = `/myths/${slug}`;

  return (
    <main className="bb-container bb-page" id="main">
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={pagePath} pageTitle={review.title} />
      <MythClaimReviewScript
        pagePath={pagePath}
        pageUrl={review.pageUrl}
        datePublished={review.datePublished}
        claimReviewed={review.claimReviewed}
        reviewBody={review.reviewBody}
        claimOrigin={review.claimOrigin}
        ratingExplanation={review.ratingExplanation}
        authorName={review.authorName}
      />
      <p className="bb-page__eyebrow">Claim review</p>
      <h1 className="bb-page__title">{review.title}</h1>
      <p className="bb-sans" style={{ color: 'var(--bb-ink-muted)' }}>
        Technique: {review.technique} · Rating: {review.ratingExplanation}
      </p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-8)' }}>
        <section className="bb-section" aria-labelledby="claim-reviewed" style={{ paddingTop: 0 }}>
          <h2 className="bb-section__title" id="claim-reviewed">
            Circulating claim
          </h2>
          <blockquote
            className="bb-sans"
            style={{
              margin: 0,
              paddingLeft: 'var(--bb-space-4)',
              borderLeft: '2px solid var(--bb-border)',
            }}
          >
            {review.claimReviewed}
          </blockquote>
          <p className="bb-sans" style={{ marginTop: 'var(--bb-space-3)', color: 'var(--bb-ink-muted)' }}>
            Attributed origin: {review.claimOrigin.name}
            {review.claimOrigin.url ? (
              <>
                {' '}
                (<a href={review.claimOrigin.url} rel="noopener noreferrer">
                  source
                </a>
                )
              </>
            ) : null}
          </p>
        </section>

        <section className="bb-section" aria-labelledby="review-body">
          <h2 className="bb-section__title" id="review-body">
            What the record shows
          </h2>
          <p className="bb-section__lede">{review.reviewBody}</p>
          {review.relatedFactUrl ? (
            <p className="bb-sans">
              <a href={review.relatedFactUrl}>Read the canonical fact record</a>
            </p>
          ) : null}
        </section>

        <section className="bb-section" aria-labelledby="how-to-verify">
          <HowToReadThisRecord />
        </section>
      </div>
    </main>
  );
}
