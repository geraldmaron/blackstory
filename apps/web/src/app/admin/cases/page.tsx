/**
 * All research cases browser — every workflow state, not only inbox.
 *
 * Server component (repo-gyq6.9). The queue is read in the request and handed to {@link CaseQueue}
 * as `initialRows`, so an operator sees the work in the first byte instead of after a hydrate, a
 * token refresh and a fetch. CaseQueue stays a client component because the surface is genuinely
 * interactive — selection, the detail sheet, transitions and assignment — and those /admin/api
 * routes remain exactly what the bead says they should be: real APIs for real mutations.
 */
import type { Metadata } from 'next';
import { CaseQueue } from '../../../admin/cases/CaseQueue';
import { ALL_CASE_STATES } from '../../../admin/cases/research-case-types';
import { listAdminResearchCases } from '../../../admin/cases/research-case-store';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';

export const metadata: Metadata = {
  title: 'Research cases — BlackStory Admin',
  description: 'Browse and manage research cases across all workflow states.',
};

/** A triage queue served from a cache is a queue someone else may already have worked. */
export const dynamic = 'force-dynamic';

export default async function CasesPage() {
  const outcome = await readPostgresOrDegrade(
    () => listAdminResearchCases({ states: ALL_CASE_STATES, limit: 200 }),
    'research cases',
  );
  const rows = outcome.status === 'ok' ? outcome.value : [];

  return (
    <main className="ds-container ds-page" id="main">
      {outcome.status === 'degraded' ? (
        <p className="story-review__alert" role="alert">
          Research cases are unavailable — the operational database did not answer. Nothing is
          listed rather than a partial set. Reload to retry.{' '}
          <span className="ds-mono">{outcome.reason}</span>
        </p>
      ) : null}
      <CaseQueue mode="cases" initialRows={rows} />
    </main>
  );
}
