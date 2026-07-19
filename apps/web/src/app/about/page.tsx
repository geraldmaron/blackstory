/**
 * About page: what BlackStory is, why it exists, who it serves, and how the
 * public archive is meant to be used — place-connected Black history with
 * evidence attached.
 */

import Link from 'next/link';

export const metadata = {
  title: 'About',
  description:
    'BlackStory is a place-connected Black history research platform. History should not be erased, should not be hard to find, and should be accessible because it is about you.',
};

export default function AboutPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Product</p>
      <h1 className="ds-page__title">History, pinned to place.</h1>
      <p className="ds-page__lede">
        BlackStory is a place-connected Black history research platform. It exists so documented
        history stays findable — especially the history close to you: your state, your city, the
        corner you pass every day. People. Places. Evidence. Context.
      </p>

      <div className="ds-prose">
        <section className="ds-section" aria-labelledby="why-heading">
          <p className="ds-section__kicker">Why</p>
          <h2 className="ds-section__title" id="why-heading">
            History should not be erased
          </h2>
          <p className="ds-section__lede">
            History shouldn&apos;t and can&apos;t be erased. When sources disagree, both claims stay
            on the record instead of one quietly winning. When a fact is corrected, the earlier
            wording remains visible in revision history. Withdrawals stay resolvable with a
            plain-language reason. The archive is built so presence and proof travel together —
            scale on the map, receipts on every record.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="find-heading">
          <p className="ds-section__kicker">Access</p>
          <h2 className="ds-section__title" id="find-heading">
            It should not be hard to find
          </h2>
          <p className="ds-section__lede">
            Most people pass documented Black history without knowing it is there. BlackStory puts
            the record back on the ground: open the map, start with your state, search by name or
            place, or follow a decade of movement. Every published claim carries citations,
            confidence you can read in words and glyphs — never color alone — and a path to
            challenge what looks wrong.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="you-heading">
          <p className="ds-section__kicker">Near you</p>
          <h2 className="ds-section__title" id="you-heading">
            Accessible because it is about you
          </h2>
          <p className="ds-section__lede">
            This is not a remote museum shelf. It is history pinned to the places people live,
            teach, report from, and visit. Choose a state. Share your location if you want to. Read
            what happened around you — with evidence attached, dignity rules enforced, and living
            people protected.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="what-heading">
          <p className="ds-section__kicker">What</p>
          <h2 className="ds-section__title" id="what-heading">
            What BlackStory is
          </h2>
          <p className="ds-section__lede">
            An archive of record with receipts. The public site serves released historical
            projections only — place-connected people, institutions, events, movements, and legal
            landmarks that clear an evidence bar. It is not crowdsourced trivia, not an anonymous
            scrape, and not a raw research dump. Between those poles sits a publish gate:
            provenance, confidence grades, living-person protections, and logged corrections.
          </p>
          <ul className="ds-sans" style={{ paddingLeft: 'var(--ds-space-5)' }}>
            <li>
              <strong>Presence over incident.</strong> The default unit is what is documented here —
              people, places, schools, institutions, laws, movements — not a trauma-first feed.
            </li>
            <li>
              <strong>Disputes stay visible.</strong> Credible disagreement is preserved, not
              collapsed into a single winner.
            </li>
            <li>
              <strong>Dignity is a rule.</strong> Public maps stop at honest precision. Street-level
              residences do not appear. Unknown living status is treated as living.
            </li>
          </ul>
        </section>

        <section className="ds-section" aria-labelledby="audience-heading">
          <p className="ds-section__kicker">Who</p>
          <h2 className="ds-section__title" id="audience-heading">
            Who it is for
          </h2>
          <p className="ds-section__lede">
            Readers, educators, journalists, students, and community researchers who need
            accountable place history — people who trust nothing by default and want trust to be
            checkable. If you are planning a visit, teaching a unit, reporting a story, or learning
            what happened on your block, this surface is built for that work.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="do-heading">
          <p className="ds-section__kicker">On the site</p>
          <h2 className="ds-section__title" id="do-heading">
            What you can do here
          </h2>
          <ul className="ds-sans" style={{ paddingLeft: 'var(--ds-space-5)' }}>
            <li>
              <Link className="ds-cta-link" href="/">
                Map
              </Link>
              {' — '}
              see documented presence nationwide, then open Explore for filters, layers, and
              place-first browsing.
            </li>
            <li>
              <Link className="ds-cta-link" href="/search">
                Search
              </Link>
              {' — '}
              find people, places, and events by name or keyword.
            </li>
            <li>
              <Link className="ds-cta-link" href="/history">
                History
              </Link>
              {' — '}
              follow connections across time and place.
            </li>
            <li>
              <Link className="ds-cta-link" href="/data">
                Data
              </Link>
              {' — '}
              read national rollups built on cited public statistics (census, ACS, and related
              coverage series).
            </li>
            <li>
              <Link className="ds-cta-link" href="/legal">
                Legal landscape
              </Link>
              {' — '}
              plain-language entry points to landmark civil-rights statutes and decisions.
            </li>
            <li>
              <Link className="ds-cta-link" href="/corrections">
                Corrections
              </Link>
              {' — '}
              challenge a published record; submissions enter moderated review with a receipt code.
            </li>
            <li>
              <Link className="ds-cta-link" href="/submit">
                Submit
              </Link>
              {' — '}
              offer a lead for research consideration (not an instant public post).
            </li>
          </ul>
        </section>

        <section className="ds-section" aria-labelledby="publish-heading">
          <p className="ds-section__kicker">Publish bar</p>
          <h2 className="ds-section__title" id="publish-heading">
            What we publish — and what we do not
          </h2>
          <p className="ds-section__lede">
            Public pages show released projections: records that passed citation completeness,
            provenance checks, and living-person protections. Draft and under-review work stay off
            public surfaces. Crime statistics never enter composite confidence. Maps never imply
            sharper location than the stored public precision, and a coarsened point is never labeled
            as an exact address.
          </p>
          <p className="ds-sans">
            The archive is incomplete by nature — many events were deliberately never documented.
            Gaps are stated plainly. Completeness is not claimed.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="auth-heading">
          <p className="ds-section__kicker">Privacy</p>
          <h2 className="ds-section__title" id="auth-heading">
            No account required
          </h2>
          <p className="ds-section__lede">
            Every public page works without authentication. Research promotion and admin tools remain
            on private surfaces. Reading here does not require creating an identity with us. Location
            sharing on the map is optional and under your control.
          </p>
        </section>

        <section className="ds-section" aria-labelledby="trust-heading">
          <p className="ds-section__kicker">Trust</p>
          <h2 className="ds-section__title" id="trust-heading">
            How to verify us
          </h2>
          <p className="ds-section__lede">
            Transparency is part of the product, not a footer afterthought. Read the definitions,
            source hierarchy, confidence grades, map dignity rules, and corrections policy on the
            methodology page. Check the errata log for logged changes. Use the corrections lane when
            evidence is missing or wrong.
          </p>
          <p className="ds-band__cta">
            <Link className="ds-cta-link" href="/methodology">
              Methodology
            </Link>
            {' · '}
            <Link className="ds-cta-link" href="/errata">
              Errata
            </Link>
            {' · '}
            <Link className="ds-cta-link" href="/corrections">
              Corrections
            </Link>
            {' · '}
            <Link className="ds-cta-link" href="/">
              Open the map
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
