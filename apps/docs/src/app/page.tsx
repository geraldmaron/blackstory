/**
 * Docs home. Editorial landing in BlackStory brand language: flat matte,
 * copper pin, lockup art, and a human project story before the contributor path.
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
          {PRODUCT_NAME} is a research platform for Black history that you can find on a map.{' '}
          {SUPPORT_LINE} Public pages show released records only: claims you can follow, precision
          you can trust, confidence you can see.
        </p>
        <div className="hero-cta">
          <Link className="btn btn-primary" href="/guides/about/">
            Why this exists →
          </Link>
          <Link className="btn" href="/guides/install/">
            Get started
          </Link>
          <a className="btn" href="https://blackstory.app" target="_blank" rel="noreferrer">
            Open the product
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
            <span className="v">Postgres · Storage</span>
          </div>
          <div className="stat" role="listitem">
            <span className="k">Code scope</span>
            <span className="v">@repo · ds-* · APP_*</span>
          </div>
        </div>
      </section>

      <aside className="callout" aria-label="From the maker">
        <p className="callout-label">From the maker</p>
        <p>
          I wanted a place where local Black history does not evaporate into a broken outbound
          link. BlackStory is being built in the open for that: entity records on a map, evidence
          you can still open, and gates strong enough that research never quietly becomes
          publication. Expect unfinished edges. Prefer careful corrections over hype.
        </p>
      </aside>

      <details className="section" open>
        <summary>
          <span className="section-num">01</span>
          <span className="section-title">
            What BlackStory <em>is for</em>
          </span>
          <span className="section-time">3 min</span>
        </summary>
        <div className="section-body">
          <p className="section-tldr">
            <strong>TL;DR</strong> A map-first archive of people, places, and events, with
            citations, confidence, and honest geographic precision. Not a search box that only
            sends you elsewhere.
          </p>
          <p>
            From the outside it feels like an archive you can walk. Under the hood it is a full
            research stack: discovery adapters, quarantine, research cases, claims, evidence
            lineage, and immutable public projections. Readers never see the kitchen. They see what
            cleared the gate.
          </p>
          <p>
            Discovery portals already excel at breadth. Specialized corpora already excel at deep
            slavery and freedom datasets. BlackStory aims at a thinner overlap: general Black
            history, shaped as entity records, pinned to place, with evidence that survives link
            rot. We are growing into that lane carefully. We do not claim completeness.
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
                Published prose cites released evidence. Confidence stays visible. Color is never
                the only signal.
              </p>
            </article>
            <article className="feature">
              <span className="num">03</span>
              <h3>Promotion gates</h3>
              <p>
                Research and LLMs can help draft. They cannot publish. Humans and policy promote
                released projections only.
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
            What we <em>refuse</em>
          </span>
          <span className="section-time">2 min</span>
        </summary>
        <div className="section-body">
          <p className="section-tldr">
            <strong>TL;DR</strong> No completeness theater, no crime-heat spectacle, no fake
            precision, no automated causation, no silent publish from models.
          </p>
          <ul>
            <li>
              Absence on the map is not proof nothing happened. It may mean sources have not cleared
              the publish gate yet.
            </li>
            <li>
              Violence-adjacent records do not become alarm-red heat maps. Dignity rules apply on
              the canvas.
            </li>
            <li>
              Showing a law beside a demographic indicator is juxtaposition for context, not a
              machine claim of cause.
            </li>
            <li>
              URL-backed citations are expected to carry archived captures before they meet the
              public evidence bar.
            </li>
          </ul>
          <p>
            Read the longer case in <Link href="/guides/about/">Why BlackStory</Link> and the
            research posture in <Link href="/guides/methodology/">Research methodology</Link>.
          </p>
        </div>
      </details>

      <details className="section">
        <summary>
          <span className="section-num">03</span>
          <span className="section-title">
            How a record becomes <em>public</em>
          </span>
          <span className="section-time">2 min</span>
        </summary>
        <div className="section-body">
          <p className="section-tldr">
            <strong>TL;DR</strong> Discover → quarantine → research → claims and evidence →
            confidence → promote → released projection. Public pages never skip the gate.
          </p>
          <pre>
            <code>{`discovery adapters
        ↓
 quarantine / triage
        ↓
  research cases
        ↓
claims · evidence · confidence
        ↓
   promotion gate
        ↓
 released public projection`}</code>
          </pre>
          <p>
            Corrections and contributions land in intake. Compromise of intake must not equal
            publish. That separation is a product feature, not an implementation accident.
          </p>
        </div>
      </details>

      <details className="section">
        <summary>
          <span className="section-num">04</span>
          <span className="section-title">
            The contributor <em>loop</em>
          </span>
          <span className="section-time">1 min</span>
        </summary>
        <div className="section-body">
          <p className="section-tldr">
            <strong>TL;DR</strong> Bootstrap, validate, run tests, then work inside the monorepo
            packages and apps. Keep brand and security boundaries intact.
          </p>
          <pre>
            <code>{`./scripts/bootstrap.sh
pnpm validate
pnpm test:preflight
pnpm test
pnpm --filter @repo/docs dev`}</code>
          </pre>
          <p>
            Prefer outcomes over tooling theater. Leave the dependency chain buildable. Cite ADRs
            and capability names in product-facing work, not internal tracker ids.
          </p>
        </div>
      </details>

      <details className="section">
        <summary>
          <span className="section-num">05</span>
          <span className="section-title">
            Where to go <em>next</em>
          </span>
          <span className="section-time">1 min</span>
        </summary>
        <div className="section-body">
          <ul>
            <li>
              <Link href="/guides/about/">Why BlackStory</Link>: the human case and empty quadrant.
            </li>
            <li>
              <Link href="/guides/install/">Install and bootstrap</Link>: clone, bootstrap, first
              validate.
            </li>
            <li>
              <Link href="/guides/architecture/">Architecture</Link>: surfaces, data plane,
              boundaries.
            </li>
            <li>
              <Link href="/guides/methodology/">Research methodology</Link>: claims, evidence,
              confidence, juxtaposition.
            </li>
            <li>
              <Link href="/guides/brand/">Brand language</Link>: signature, palette, type, map
              dignity.
            </li>
            <li>
              <Link href="/guides/security/">Security posture</Link>: hostile-environment defaults.
            </li>
            <li>
              <a href={REPO_URL}>Repository</a>: full operating docs under <code>docs/</code>.
            </li>
            <li>
              <a href="https://blackstory.app">blackstory.app</a>: the live product.
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
