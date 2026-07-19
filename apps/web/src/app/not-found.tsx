/**
 * Global not-found page for unknown public routes and missing entities.
 */

import { EmptyState } from '@repo/ui';
import { StatusPage } from '../components/StatusPage';

export default function NotFound() {
  return (
    <StatusPage
      eyebrow="404"
      title="Page not found"
      lede="That route is not part of the public shell, or the entity id is unknown."
    >
      <div className="ds-page--status__body">
        <EmptyState
          title="Nothing to show here"
          action={
            <a className="ds-button ds-button--primary" href="/search">
              Search the archive
            </a>
          }
        >
          Try Search, Explore, or return to the home page. Design-system fixtures remain at
          /design-system.
        </EmptyState>
      </div>
    </StatusPage>
  );
}
