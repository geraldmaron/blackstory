/**
 * Individual myth review page the ONLY pages that emit schema.org ClaimReview markup.
 */
import { notFound } from 'next/navigation';
import {
  HowToReadThisRecord,
  MythClaimReviewScript,
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
} from '../../../components/trust/index';
import { getMythReview } from '../../../lib/trust/myths-seed';

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
    <main className="ds-container ds-page" id="main">
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
      <p className="ds-page__eyebrow">Claim review</p>
      <h1 className="ds-page__title">{review.title}</h1>
      <p className="ds-sans" style={{ color: 'var(--ds-ink-muted)' }}>
        Technique: {review.technique} · Rating: {review.ratingExplanation}
      </p>

      <div className="ds-stack" style={{ marginTop: 'var(--ds-space-8)' }}>
        <section className="ds-section" aria-labelledby="claim-reviewed" style={{ paddingTop: 0 }}>
          <h2 className="ds-section__title" id="claim-reviewed">
            Circulating claim
          </h2>
          <blockquote
            className="ds-sans"
            style={{
              margin: 0,
              paddingLeft: 'var(--ds-space-4)',
              borderLeft: 'var(--ds-border-width-strong) solid var(--ds-border)',
            }}
          >
            {review.claimReviewed}
          </blockquote>
          <p className="ds-sans" style={{ marginTop: 'var(--ds-space-3)', color: 'var(--ds-ink-muted)' }}>
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

        <section className="ds-section" aria-labelledby="review-body">
          <h2 className="ds-section__title" id="review-body">
            What the record shows
          </h2>
          <p className="ds-section__lede">{review.reviewBody}</p>
          {review.relatedFactUrl ? (
            <p className="ds-sans">
              <a href={review.relatedFactUrl}>Read the canonical fact record</a>
            </p>
          ) : null}
        </section>

        <section className="ds-section" aria-labelledby="how-to-verify">
          <HowToReadThisRecord />
        </section>
      </div>
    </main>
  );
}
