/**
 * Global not-found page for unknown public routes and missing seed entities.
 */

import { EmptyState } from '@black-book/ui';

export default function NotFound() {
  return (
    <main className="bb-container bb-page" id="main">
      <p className="bb-page__eyebrow">404</p>
      <h1 className="bb-page__title">Page not found</h1>
      <p className="bb-page__lede">
        That route is not part of the public shell, or the sample entity id is unknown.
      </p>
      <div style={{ marginTop: 'var(--bb-space-6)' }}>
        <EmptyState
          title="Nothing to show here"
          action={
            <a className="bb-button bb-button--primary" href="/search">
              Browse sample records
            </a>
          }
        >
          Try Search, Explore, or return to the home page. Design-system fixtures remain at
          /design-system.
        </EmptyState>
      </div>
    </main>
  );
}
