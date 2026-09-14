/**
 * Inbox — pending research-case triage queue (candidate, relevance review, needs evidence).
 *
 * Server component (repo-gyq6.9). The queue is read in the request and handed to {@link CaseQueue}
 * as `initialRows`, so an operator sees the work in the first byte instead of after a hydrate, a
 * token refresh and a fetch. CaseQueue stays a client component because the surface is genuinely
 * interactive — selection, the detail sheet, transitions and assignment — and those /admin/api
 * routes remain exactly what the bead says they should be: real APIs for real mutations.
 */
import type { Metadata } from 'next';
import { CaseQueue } from '../../../admin/cases/CaseQueue';
import { INBOX_CASE_STATES } from '../../../admin/cases/research-case-types';
import { listAdminResearchCases } from '../../../admin/cases/research-case-store';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';

export const metadata: Metadata = {
  title: 'Inbox — BlackStory Admin',
  description: 'Work the pending research-case queue before anything publishes.',
};

/** A triage queue served from a cache is a queue someone else may already have worked. */
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const outcome = await readPostgresOrDegrade(
    () => listAdminResearchCases({ states: INBOX_CASE_STATES, limit: 200 }),
    'inbox queue',
  );
  const rows = outcome.status === 'ok' ? outcome.value : [];

  return (
    <main className="ds-container ds-page" id="main">
      {outcome.status === 'degraded' ? (
        <p className="story-review__alert" role="alert">
          The triage queue is unavailable — the operational database did not answer. Nothing is
          listed rather than a partial queue, because a half-loaded inbox looks like a worked one.
          Reload to retry. <span className="ds-mono">{outcome.reason}</span>
        </p>
      ) : null}
      <CaseQueue mode="inbox" initialRows={rows} />
    </main>
  );
}
