
/**
 * Representative HTML fixtures for core public journeys.
 * Strings mirror the server-rendered structure of search, explore, entity, locate,
 * corrections, and degraded-mode shells not live fetches.
 */

export type CoreJourneyId =
  | 'search'
  | 'explore'
  | 'entity'
  | 'locate'
  | 'corrections'
  | 'degraded-shell';

export type CoreJourneyFixture = {
  readonly id: CoreJourneyId;
  readonly label: string;
  readonly html: string;
};

/** Minimal accessible search results page shell. */
const SEARCH_FIXTURE = `
  <main id="main">
    <header>
      <p>Index</p>
      <h1>Search</h1>
      <p>Search runs against the current sample catalog.</p>
    </header>
    <form method="get" action="/search">
      <fieldset>
        <legend>Filter sample records</legend>
        <label for="q">Search</label>
        <input id="q" name="q" type="search" />
        <label for="kind">Kind</label>
        <select id="kind" name="kind"><option value="">All</option></select>
      </fieldset>
    </form>
    <p id="search-results-heading">3 sample results</p>
    <ul aria-labelledby="search-results-heading">
      <li><a href="/entity/ent_seed_place_001">Harlem Cultural Corridor</a></li>
    </ul>
    <nav aria-label="Search results pages">
      <a href="/search?offset=0">Previous page</a>
    </nav>
  </main>
`;

/** Explore page with accessible list peer beside map region. */
const EXPLORE_FIXTURE = `
  <main id="main">
    <header>
      <p>National map</p>
      <h1>Explore Black history everywhere</h1>
      <p>The list beside the map is the full accessibility peer, not a fallback.</p>
    </header>
    <form method="get" action="/explore">
      <fieldset>
        <legend>Filter documented records</legend>
        <label for="explore-kind">Kind</label>
        <select id="explore-kind" name="kind"><option value="">All</option></select>
      </fieldset>
    </form>
    <section aria-labelledby="explore-results-heading">
      <h2 id="explore-results-heading">Documented records</h2>
      <ul class="ds-result-list" aria-labelledby="explore-results-heading">
        <li>
          <a href="/entity/ent_seed_place_001" aria-current="true">
            <span aria-hidden="true">●</span> Harlem Cultural Corridor
          </a>
        </li>
      </ul>
    </section>
    <section aria-label="Interactive map" aria-hidden="false">
      <p role="status">The interactive map could not load — showing the accessible list view.</p>
    </section>
  </main>
`;

/** Entity detail shell with section landmarks. */
const ENTITY_FIXTURE = `
  <main id="main">
    <header>
      <p>place · New York, NY · Present-day record</p>
      <h1>Harlem Cultural Corridor</h1>
      <p>Public summary safe for previews.</p>
    </header>
    <section aria-labelledby="relevance-heading">
      <h2 id="relevance-heading">Why this appears</h2>
      <p>Relevance explanation without numeric scores.</p>
    </section>
    <section aria-labelledby="evidence-heading">
      <h2 id="evidence-heading">Evidence</h2>
      <ul><li>Cited claim with public citation label</li></ul>
    </section>
  </main>
`;

/** Locate page with privacy notice and no-JS fallback. */
const LOCATE_FIXTURE = `
  <main id="main">
    <header>
      <p>Discover</p>
      <h1>Find your jurisdiction</h1>
      <p>Resolve an address, ZIP, or current location.</p>
    </header>
    <section aria-labelledby="location-privacy-heading">
      <h2 id="location-privacy-heading">Location privacy</h2>
      <p>Coordinates are not stored for advertising.</p>
    </section>
    <form>
      <label for="locate-address">Address or ZIP</label>
      <input id="locate-address" name="address" type="search" autocomplete="street-address" />
    </form>
    <noscript>
      <p>You can still <a href="/search">search records directly</a>.</p>
    </noscript>
  </main>
`;

/** Corrections intake shell. */
const CORRECTIONS_FIXTURE = `
  <main id="main">
    <p>Trust</p>
    <h1>Corrections</h1>
    <p>Challenge or correct a published record through moderated review.</p>
    <div role="status">
      <p>This is not a public post — submissions enter quarantine for review.</p>
    </div>
    <form>
      <label for="correction-target">Record or claim URL</label>
      <input id="correction-target" name="target" type="url" required />
      <label for="correction-detail">What should change?</label>
      <textarea id="correction-detail" name="detail"></textarea>
    </form>
  </main>
`;

/** Root shell degraded banner paired with stable main content. */
const DEGRADED_SHELL_FIXTURE = `
  <a class="ds-skip-link" href="#main">Skip to main content</a>
  <div role="status">
    <p>Showing snapshot data</p>
    <p>Live reads are temporarily disabled. Pages are serving the last published release snapshot.</p>
  </div>
  <main id="main">
    <h1>Search</h1>
    <p>Snapshot catalog remains readable during degraded mode.</p>
  </main>
`;

export const CORE_JOURNEY_FIXTURES: readonly CoreJourneyFixture[] = Object.freeze([
  { id: 'search', label: 'Search results ()', html: SEARCH_FIXTURE },
  { id: 'explore', label: 'Explore map + list peer ()', html: EXPLORE_FIXTURE },
  { id: 'entity', label: 'Entity detail ()', html: ENTITY_FIXTURE },
  { id: 'locate', label: 'Locate jurisdiction ()', html: LOCATE_FIXTURE },
  { id: 'corrections', label: 'Corrections intake ()', html: CORRECTIONS_FIXTURE },
  {
    id: 'degraded-shell',
    label: 'Degraded snapshot shell ()',
    html: DEGRADED_SHELL_FIXTURE,
  },
]);
