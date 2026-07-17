/**
 * About page describing the Black Book public product.
 */

export const metadata = {
  title: 'About',
  description: 'What Black Book is and who the public interface is for.',
};

export default function AboutPage() {
  return (
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">Product</p>
      <h1 className="bb-page__title">About Black Book</h1>
      <p className="bb-page__lede">
        Black Book is a place-connected Black history research platform. The public web app serves
        only released historical projections with provenance, confidence, and living-person
        protections.
      </p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-8)', maxWidth: '40rem' }}>
        <section className="bb-section" style={{ paddingTop: 0 }} aria-labelledby="audience-heading">
          <h2 className="bb-section__title" id="audience-heading">
            Who it is for
          </h2>
          <p className="bb-section__lede">
            Readers, educators, journalists, and community researchers who need accountable place
            history — not anonymous scrapes or unverifiable timelines.
          </p>
        </section>

        <section className="bb-section" aria-labelledby="auth-heading">
          <h2 className="bb-section__title" id="auth-heading">
            No account required
          </h2>
          <p className="bb-section__lede">
            Core public pages are usable without authentication. Research, promotion, and admin
            tools remain on private surfaces.
          </p>
        </section>

        <section className="bb-section" aria-labelledby="status-heading">
          <h2 className="bb-section__title" id="status-heading">
            Build status
          </h2>
          <p className="bb-section__lede">
            This interface is an early public shell (BB-048) reading sample seed data. Live
            projections (BB-019), search (BB-049), and geocoding (BB-050) are still in progress.
          </p>
          <p style={{ marginTop: 'var(--bb-space-4)' }}>
            <a className="bb-cta-link" href="/methodology">
              Methodology
            </a>
            {' · '}
            <a className="bb-cta-link" href="/corrections">
              Corrections
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
