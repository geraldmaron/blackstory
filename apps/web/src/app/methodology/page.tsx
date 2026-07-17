/**
 * Methodology and transparency overview for public readers.
 */

import { Citation, Confidence, Notice } from '@black-book/ui';

export const metadata = {
  title: 'Methodology',
  description: 'How Black Book decides what qualifies, how confidence works, and what stays private.',
};

export default function MethodologyPage() {
  return (
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">Transparency</p>
      <h1 className="bb-page__title">Methodology</h1>
      <p className="bb-page__lede">
        Black Book publishes released historical projections — not raw research scrapes, not
        residential dossiers, and not claims that cannot clear constitution thresholds.
      </p>

      <div className="bb-stack" style={{ marginTop: 'var(--bb-space-8)' }}>
        <section className="bb-section" aria-labelledby="qualify-method" style={{ paddingTop: 0 }}>
          <h2 className="bb-section__title" id="qualify-method">
            What qualifies
          </h2>
          <p className="bb-section__lede">
            A record must clear relevance thresholds, demonstrate place connection at an allowed
            precision, carry accepted claims with evidence rights, and survive living-person
            redaction before public release.
          </p>
        </section>

        <section className="bb-section" aria-labelledby="confidence-method">
          <h2 className="bb-section__title" id="confidence-method">
            Confidence & disputes
          </h2>
          <p className="bb-section__lede">
            Confidence combines independent evidence lineages — syndicated copies do not inflate
            scores. Contradictions stay visible instead of being collapsed into a single “winner.”
          </p>
          <div className="bb-row" style={{ marginTop: 'var(--bb-space-4)' }}>
            <Confidence level="high" />
            <Confidence level="medium" />
            <Confidence level="low" />
          </div>
          <div style={{ marginTop: 'var(--bb-space-4)' }}>
            <Notice tone="dispute" title="Competing attributions stay on the record">
              When credible sources disagree, Black Book preserves alternate values rather than
              erasing minority evidence.
            </Notice>
          </div>
        </section>

        <section className="bb-section" aria-labelledby="precision-method">
          <h2 className="bb-section__title" id="precision-method">
            Location precision
          </h2>
          <p className="bb-section__lede">
            Public maps may show country through campus/institution precision. Street address, unit,
            parcel, residence, and exact coordinates needed only for private research are prohibited
            on public surfaces.
          </p>
        </section>

        <section className="bb-section" aria-labelledby="cite-method">
          <h2 className="bb-section__title" id="cite-method">
            Provenance
          </h2>
          <p className="bb-section__lede">
            Citations expose the source organization and classification so readers can audit the
            chain of custody without treating the UI as the archival original.
          </p>
          <div style={{ marginTop: 'var(--bb-space-4)' }}>
            <Citation
              source="Product constitution · policy.v1"
              label="Policy reference"
              href="/methodology"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
