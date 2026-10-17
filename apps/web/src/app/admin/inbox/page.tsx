/**
 * Inbox — pending research-case triage queue (candidate, relevance review, needs evidence).
 *
 * Server component. Search, state, assignee, sort and page are URL params resolved in SQL; see
 * {@link CaseQueuePage}. The `/admin/api` routes handle the interactive mutations.
 */
import type { Metadata } from 'next';
import { CaseQueuePage } from '../../../admin/cases/CaseQueuePage';

export const metadata: Metadata = {
  title: 'Inbox',
  description: 'Work the pending research-case queue before anything publishes.',
};

/** A triage queue served from a cache is a queue someone else may already have worked. */
export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CaseQueuePage mode="inbox" searchParams={await searchParams} />;
}
