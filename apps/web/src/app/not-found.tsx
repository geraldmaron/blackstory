/**
 * Global not-found page for unknown public routes and missing entities.
 * v6 utility edition with shared gutter mosaic and fail-state EmptyState.
 */

import Link from 'next/link';
import { EmptyState } from '@repo/ui';
import { UtilityEditionBodyPanel } from '../components/patterns/utility-edition/UtilityEditionBodyPanel';
import { UtilityEditionIntro } from '../components/patterns/utility-edition/UtilityEditionIntro';
import { UtilityEditionShell } from '../components/patterns/utility-edition/UtilityEditionShell';
import '../components/patterns/utility-edition/utility-edition.css';

export default function NotFound() {
  return (
    <UtilityEditionShell mosaicSeed="not-found-edition-v6" editionKey="not-found">
      <UtilityEditionIntro
        index="404"
        kicker="Missing route"
        title="Page not found"
        lede="That route is not part of the public shell, or the entity id is unknown."
        variant="status"
      />
      <UtilityEditionBodyPanel>
        <EmptyState
          title="Nothing to show here"
          action={
            <Link className="ds-button ds-button--primary" href="/history">
              Find in the archive
            </Link>
          }
        >
          Try History, Explore, or return to the home page. Design-system fixtures remain at
          /design-system.
        </EmptyState>
      </UtilityEditionBodyPanel>
    </UtilityEditionShell>
  );
}
