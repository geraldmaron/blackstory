/**
 * About page describing the BlackStory public product.
 */

import Link from 'next/link';

export const metadata = {
  title: 'About',
  description: 'What BlackStory is and who the public interface is for.',
};

export default function AboutPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Product</p>
      <h1 className="ds-page__title">History, pinned to place.</h1>
      <p className="ds-page__lede">
        BlackStory is a place-connected Black history research platform. It exists to connect people
        with documented history — especially the history close to them: their state, their city,
        the corner they pass every day. The public site serves only released historical
        projections, with provenance, confidence, and living-person protections.
      </p>

      <div className="ds-prose">
        <section className="ds-section" aria-labelledby="mission-heading">
          <p className="ds-section__kicker">Why</p>
          <h2 className="ds-section__title" id="mission-heading">
            Learn what happened where you are
          </h2>
          <p className="ds-section__lede">
            Most people pass documented Black history without knowing it is there. The map puts
            the record back on the ground: choose your state, share your location if you want
            to, and see what happened around you — with the evidence attached.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="audience-heading">
          <p className="ds-section__kicker">Who</p>
          <h2 className="ds-section__title" id="audience-heading">
            Who it is for
          </h2>
          <p className="ds-section__lede">
            Readers, educators, journalists, and community researchers who need accountable place
            history — not anonymous scrapes or unverifiable timelines.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="auth-heading">
          <p className="ds-section__kicker">Access</p>
          <h2 className="ds-section__title" id="auth-heading">
            No account required
          </h2>
          <p className="ds-section__lede">
            Every public page works without authentication. Research, promotion, and admin tools
            remain on private surfaces; nothing you read here tracks who you are.
          </p>
          <p className="ds-band__cta">
            <Link className="ds-cta-link" href="/methodology">
              Methodology
            </Link>
            {' · '}
            <Link className="ds-cta-link" href="/corrections">
              Corrections
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
