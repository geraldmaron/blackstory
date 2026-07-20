/**
 * Docs home — editorial landing modeled on Construct's docs hero,
 * expressed in BlackStory brand language (flat matte, copper pin, lockup art).
 */
import Image from 'next/image';
import Link from 'next/link';
import { withBasePath } from '@/lib/base-path';
import { PRODUCT_NAME, REPO_URL, SUPPORT_LINE, TAGLINE } from '@/lib/site';

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <p className="hero-eyebrow">
          <span className="pin" aria-hidden />
          <span>place-connected research</span>
          <span aria-hidden>·</span>
          <span>open source</span>
        </p>
        <Image
          src={withBasePath('/brand/lockup-light.png')}
          alt={PRODUCT_NAME}
          width={320}
          height={72}
          className="hero-lockup brand-light"
          priority
          unoptimized
        />
        <Image
          src={withBasePath('/brand/lockup-dark.png')}
          alt=""
          width={320}
          height={72}
          className="hero-lockup brand-dark"
          aria-hidden
          priority
          unoptimized
        />
        <h1 id="hero-heading">
          History,
          <br />
          <em>pinned to place.</em>
        </h1>
        <p className="hero-sub">
          {PRODUCT_NAME} is a place-connected Black history research platform. {SUPPORT_LINE} Public
          surfaces serve released projections only — evidence, confidence, and provenance stay
          visible.
        </p>
        <div className="hero-cta">
          <Link className="btn btn-primary" href="/guides/install/">
            Get started →
          </Link>
          <Link className="btn" href="/guides/architecture/">
            See the architecture
          </Link>
          <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
            Repo
          </a>
        </div>
        <div className="stat-grid" role="list">
          <div className="stat" role="listitem">
            <span className="k">Focus</span>
            <span className="v">People · Places · Evidence</span>
          </div>
          <div className="stat" role="listitem">
            <span className="k">Public read</span>
            <span className="v">Released projections only</span>
          </div>
          <div className="stat" role="listitem">
            <span className="k">Data plane</span>
            <span className="v">Firestore · Storage</span>
          </div>
          <div className="stat" role="listitem">
            <span className="k">Code scope</span>
            <span className="v">@repo · ds-* · APP_*</span>
          </div>
        </div>
      </section>

      <aside className="callout" aria-label="From the maker">
        <p className="callout-label">Heads up — from the maker</p>
        <p>
          BlackStory is being built in the open. Expect rough edges, changing docs, and unfinished
          cloud wiring. The repository is the source of truth; this site is the orientation layer.
          Contributions and careful corrections are welcome.
        </p>
      </aside>

      <details className="section" open>
        <summary>
          <span className="section-num">01</span>
          <span className="section-title">
            What BlackStory <em>is</em>
          </span>
          <span className="section-time">2 min</span>
        </summary>
        <div className="section-body">
          <p className="section-tldr">
            <strong>TL;DR</strong> — History pinned to place. Public readers see released claims
            with evidence and confidence. Research and promotion stay private until a record clears
            the gate.
          </p>
          <p>
            From the outside, BlackStory feels like a map and archive of Black history tied to real
            locations. Under the hood it is a research platform: discovery adapters, quarantine,
            research cases, claims, evidence lineage, and immutable public projections.
          </p>
          <div className="feature-grid">
            <article className="feature">
              <span className="num">01</span>
              <h3>Place first</h3>
              <p>
                Locations carry precision. A coarsened point is never labeled as an exact address.
              </p>
            </article>
            <article className="feature">
              <span className="num">02</span>
              <h3>Evidence before assertion</h3>
              <p>
                Published prose cites released evidence. Confidence stays visible — color is never
                the only signal.
              </p>
            </article>
            <article className="feature">
              <span className="num">03</span>
              <h3>Promotion gates</h3>
              <p>
                Research and LLMs cannot publish. Human and policy gates promote released
                projections only.
              </p>
            </article>
            <article className="feature">
              <span className="num">04</span>
              <h3>Living-person care</h3>
              <p>Unknown living status is treated as living. No public residential addresses.</p>
            </article>
          </div>
        </div>
      </details>

      <details className="section">
        <summary>
          <span className="section-num">02</span>
          <span className="section-title">
            The contributor <em>loop</em>
          </span>
          <span className="section-time">1 min</span>
        </summary>
        <div className="section-body">
          <p className="section-tldr">
            <strong>TL;DR</strong> — Bootstrap, validate, run tests, then work inside the monorepo
            packages and apps.
          </p>
          <pre>
            <code>{`./scripts/bootstrap.sh
pnpm validate
pnpm test:preflight
pnpm test
pnpm --filter @repo/docs dev`}</code>
          </pre>
          <p>
            Prefer the outcome over the tool: claim work with beads, keep brand and security
            boundaries intact, and leave the dependency chain buildable.
          </p>
        </div>
      </details>

      <details className="section">
        <summary>
          <span className="section-num">03</span>
          <span className="section-title">
            Where to go <em>next</em>
          </span>
          <span className="section-time">1 min</span>
        </summary>
        <div className="section-body">
          <ul>
            <li>
              <Link href="/guides/install/">Install and bootstrap</Link> — clone, bootstrap, first
              validate.
            </li>
            <li>
              <Link href="/guides/architecture/">Architecture</Link> — surfaces, data plane,
              boundaries.
            </li>
            <li>
              <Link href="/guides/brand/">Brand language</Link> — signature, palette, type, map
              dignity.
            </li>
            <li>
              <Link href="/guides/methodology/">Research methodology</Link> — claims, evidence,
              confidence.
            </li>
            <li>
              <Link href="/guides/adrs/">Architecture decisions</Link> — pointers into the ADR set.
            </li>
            <li>
              <a href={REPO_URL}>Repository</a> — full operating docs under <code>docs/</code>.
            </li>
          </ul>
        </div>
      </details>

      <footer className="site-footer">
        <p>
          {PRODUCT_NAME} · {TAGLINE} · <a href={REPO_URL}>github.com/geraldmaron/blackstory</a>
        </p>
      </footer>
    </>
  );
}
