/**
 * About page describing the Blap public product.
 */

export const metadata = {
  title: 'About',
  description: 'What Blap is and who the public interface is for.',
};

export default function AboutPage() {
  return (
    <main className="bp-container bp-page" id="main">
      <p className="bp-page__eyebrow">Product</p>
      <h1 className="bp-page__title">About Blap</h1>
      <p className="bp-page__lede">
        Blap is a place-connected Black history research platform. The public web app serves
        only released historical projections with provenance, confidence, and living-person
        protections.
      </p>

      <div className="bp-stack" style={{ marginTop: 'var(--bp-space-8)', maxWidth: '40rem' }}>
        <section className="bp-section" style={{ paddingTop: 0 }} aria-labelledby="audience-heading">
          <h2 className="bp-section__title" id="audience-heading">
            Who it is for
          </h2>
          <p className="bp-section__lede">
            Readers, educators, journalists, and community researchers who need accountable place
            history — not anonymous scrapes or unverifiable timelines.
          </p>
        </section>

        <section className="bp-section" aria-labelledby="auth-heading">
          <h2 className="bp-section__title" id="auth-heading">
            No account required
          </h2>
          <p className="bp-section__lede">
            Core public pages are usable without authentication. Research, promotion, and admin
            tools remain on private surfaces.
          </p>
        </section>

        <section className="bp-section" aria-labelledby="status-heading">
          <h2 className="bp-section__title" id="status-heading">
            Build status
          </h2>
          <p className="bp-section__lede">
            This interface is an early public shell (BB-048) reading sample seed data. Live
            projections (BB-019), search (BB-049), and geocoding (BB-050) are still in progress.
          </p>
          <p style={{ marginTop: 'var(--bp-space-4)' }}>
            <a className="bp-cta-link" href="/methodology">
              Methodology
            </a>
            {' · '}
            <a className="bp-cta-link" href="/corrections">
              Corrections
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
