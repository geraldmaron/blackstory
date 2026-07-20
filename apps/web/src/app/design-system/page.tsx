/**
 * Design-system fixture gallery (Storybook equivalent) for component and token states.
 * Stays current with docs/ui/design-direction-v5.md — new shell patterns land here too.
 */

import Link from 'next/link';
import {
  Button,
  Card,
  Citation,
  Confidence,
  EmptyState,
  FilterBar,
  MapFrame,
  Notice,
  ResultList,
  ThemeToggle,
  Timeline,
} from '@repo/ui';
import { DialogFixture } from './DialogFixture';

export const metadata = {
  title: 'Design system — BlackStory',
  description: 'Component and token fixtures for visual and keyboard review (design-direction-v5)',
};

export default function DesignSystemPage() {
  return (
    <main className="ds-container" id="main">
      <header className="ds-gallery-section" style={{ paddingTop: 'var(--ds-space-10)' }}>
        <p className="ds-page__eyebrow">Design direction v5</p>
        <h1 className="ds-page__title">Design system</h1>
        <p>
          Archive Paper / Black Ink foundation, copper as the orientation signal, hairline
          separation, visible focus, reduced-motion support. This route is the component fixture
          gallery (Storybook equivalent).
        </p>
        <div className="ds-row">
          <ThemeToggle />
          <Link className="ds-sans" href="/">
            Back to home
          </Link>
        </div>
      </header>

      <section className="ds-gallery-section" aria-labelledby="actions-heading">
        <h2 id="actions-heading">Actions</h2>
        <p>
          One vocabulary, three weights (v5 §5): copper is THE primary action of a view — max one
          per composition; solid inverts with theme; quiet is a hairline. On fixed charcoal{' '}
          <code className="ds-mono">.ds-band</code> surfaces, solid and quiet both use fixed-paper
          tokens so light-mode site theme never paints black ink on charcoal.
        </p>
        <div className="ds-row">
          <Link className="ds-cta ds-cta--copper" href="#actions-heading">
            Primary action
          </Link>
          <Link className="ds-cta ds-cta--solid" href="#actions-heading">
            Solid action
          </Link>
          <Link className="ds-cta ds-cta--quiet" href="#actions-heading">
            Quiet action
          </Link>
          <Link className="ds-cta-link" href="#actions-heading">
            Text link
          </Link>
        </div>
        <div className="ds-row">
          <Button type="button" variant="primary">
            Form primary
          </Button>
          <Button type="button" variant="secondary">
            Form secondary
          </Button>
        </div>
        <div className="ds-band" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p className="ds-section__kicker">Fixed ink band</p>
          <p className="ds-band__cta" style={{ marginTop: '1rem' }}>
            <Link className="ds-cta ds-cta--solid" href="#actions-heading">
              Solid on band
            </Link>
            <Link className="ds-cta ds-cta--quiet" href="#actions-heading">
              Quiet on band
            </Link>
          </p>
        </div>
      </section>

      <section className="ds-gallery-section" aria-labelledby="shell-patterns-heading">
        <h2 id="shell-patterns-heading">Story link, chips & data strip</h2>
        <p>
          Lists and rails use top-rule entries, never boxes; chips are the compact pick-one
          affordance; the data strip is the mono numbers register.
        </p>
        <ul className="ds-story-rail">
          <li>
            <Link className="ds-story-link" href="#shell-patterns-heading">
              <span className="ds-story-link__meta">School / Washington, D.C.</span>
              <h3 className="ds-story-link__title">Story link entry</h3>
              <p className="ds-story-link__summary">
                Mono slug, Sora title, serif one-line story — the shared anatomy for rails, related
                lists, and browse paths.
              </p>
            </Link>
          </li>
        </ul>
        <div className="ds-row">
          <Link className="ds-state-chip" href="#shell-patterns-heading">
            Georgia<span className="ds-state-chip__count">17</span>
          </Link>
          <Link className="ds-state-chip" href="#shell-patterns-heading">
            Alabama<span className="ds-state-chip__count">12</span>
          </Link>
        </div>
        <ul className="ds-data-strip">
          <li className="ds-data-strip__item">
            <span className="ds-data-strip__value">104</span>
            <span className="ds-data-strip__label">Records pinned</span>
          </li>
          <li className="ds-data-strip__item">
            <span className="ds-data-strip__value">24</span>
            <span className="ds-data-strip__label">States on the map</span>
          </li>
          <li className="ds-data-strip__item">
            <span className="ds-data-strip__value">1820s–1970s</span>
            <span className="ds-data-strip__label">Eras spanned</span>
          </li>
        </ul>
      </section>

      <section className="ds-gallery-section" aria-labelledby="tokens-heading">
        <h2 id="tokens-heading">Tokens</h2>
        <p>Black and paper lead; copper points; sand fills. Status hues are reserved.</p>
        <div className="ds-row" aria-label="Confidence levels">
          <Confidence level="high" />
          <Confidence level="medium" />
          <Confidence level="low" />
        </div>
        <div className="ds-stack">
          <Notice tone="warning" title="Source capture incomplete">
            Additional archival pages are still under review.
          </Notice>
          <Notice tone="dispute" title="Competing place attributions">
            Two accepted claims disagree on the 1910 school address.
          </Notice>
          <Notice tone="error" title="Projection unavailable">
            Public read path returned a transient error.
          </Notice>
        </div>
      </section>

      <section className="ds-gallery-section" aria-labelledby="card-heading">
        <h2 id="card-heading">Cards & citations</h2>
        <p>
          Cards group related research content; citations expose provenance without color-only cues.
        </p>
        <Card
          title="Rosenwald School site"
          meta={<span className="ds-mono">entity:place</span>}
          interactive
        >
          <p className="ds-sans" style={{ marginTop: 0 }}>
            Documented community school associated with early twentieth-century Black education
            networks.
          </p>
          <Citation
            source="Library of Congress — American Memory"
            href="https://www.loc.gov/"
            label="Primary source"
          />
        </Card>
      </section>

      <section className="ds-gallery-section" aria-labelledby="results-heading">
        <h2 id="results-heading">Filters & results</h2>
        <p>Native labelled controls and a keyboard-reachable result list.</p>
        <FilterBar
          legend="Filter historical places"
          fields={[
            {
              id: 'q',
              name: 'q',
              label: 'Search',
              type: 'search',
              placeholder: 'School, church, neighborhood…',
            },
            {
              id: 'era',
              name: 'era',
              label: 'Era',
              type: 'select',
              defaultValue: 'all',
              options: [
                { value: 'all', label: 'All eras' },
                { value: 'reconstruction', label: 'Reconstruction' },
                { value: 'civil-rights', label: 'Civil rights' },
              ],
            },
          ]}
        />
        <ResultList
          labelledBy="results-heading"
          items={[
            {
              id: '1',
              href: '#card-heading',
              title: 'Freedom School annex',
              summary: 'Temporary classroom used during a local desegregation campaign.',
              meta: (
                <>
                  <Confidence level="high" />
                  <span className="ds-mono">1964</span>
                </>
              ),
            },
            {
              id: '2',
              href: '#timeline-heading',
              title: 'Mutual aid hall',
              summary: 'Meeting place tied to burial-society records and oral histories.',
              meta: <Confidence level="medium" />,
            },
          ]}
        />
      </section>

      <section className="ds-gallery-section" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">Timeline</h2>
        <p>Chronological narrative with monospace dates.</p>
        <Timeline
          labelledBy="timeline-heading"
          items={[
            {
              id: 't1',
              time: '1908',
              title: 'School constructed',
              body: 'Community fundraising completes the first frame building.',
            },
            {
              id: 't2',
              time: '1954',
              title: 'Enrollment peak',
              body: 'County records list the highest documented pupil count.',
            },
            {
              id: 't3',
              time: '1969',
              title: 'Consolidation',
              body: 'Students move to a newly integrated district campus.',
            },
          ]}
        />
      </section>

      <section className="ds-gallery-section" aria-labelledby="map-heading">
        <h2 id="map-heading">Map frame</h2>
        <p>Geographic context with an accessible name that includes pin labels.</p>
        <MapFrame
          title="Historic neighborhood map"
          caption="Schematic fixture — pin marks approximate school parcel."
          pins={[{ id: 'school', label: 'Rosenwald School site', x: 42, y: 58 }]}
        />
      </section>

      <section className="ds-gallery-section" aria-labelledby="dialog-heading">
        <h2 id="dialog-heading">Dialog</h2>
        <p>Focus moves into the modal; Escape and the close control dismiss it.</p>
        <DialogFixture />
      </section>

      <section className="ds-gallery-section" aria-labelledby="empty-heading">
        <h2 id="empty-heading">Empty state</h2>
        <p>Zero-result messaging with a clear next action.</p>
        <EmptyState
          title="No places matched"
          action={
            <Button type="button" variant="secondary">
              Clear filters
            </Button>
          }
        >
          Try a broader era filter or remove exact street constraints.
        </EmptyState>
      </section>
    </main>
  );
}
