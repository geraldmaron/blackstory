/**
 * Global not-found page for unknown public routes and missing seed entities.
 */

import { EmptyState } from '@blap/ui';
import { StatusPage } from '../components/StatusPage';

export default function NotFound() {
  return (
    <StatusPage
      eyebrow="404"
      title="Page not found"
      lede="That route is not part of the public shell, or the sample entity id is unknown."
    >
      <div className="bp-page--status__body">
        <EmptyState
          title="Nothing to show here"
          action={
            <a className="bp-button bp-button--primary" href="/search">
              Browse sample records
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
