/**
 * All research cases — every workflow state, not only the inbox.
 *
 * Server component. Search, state, assignee, sort and page are URL params resolved in SQL; see
 * {@link CaseQueuePage}. The `/admin/api` routes handle the interactive mutations.
 */
import type { Metadata } from 'next';
import { CaseQueuePage } from '../../../admin/cases/CaseQueuePage';

export const metadata: Metadata = {
  title: 'Research cases',
  description: 'Browse and manage research cases across all workflow states.',
};

/** A triage queue served from a cache is a queue someone else may already have worked. */
export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CaseQueuePage mode="cases" searchParams={await searchParams} />;
}
