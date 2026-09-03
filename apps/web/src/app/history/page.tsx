/**
 * `/history` no longer renders. The decade stepper is the Explore Time panel, the kind composition
 * graph belongs to `/data`, and the record list is `/records`, so this route survives only to
 * keep every `/history` bookmark and cached 308 resolving — `decade` mapped to `era`, in one hop.
 *
 * It can never be deleted: it is the destination of permanent redirects that are already cached
 * in browsers and search indexes.
 */
import { permanentRedirect } from 'next/navigation';
import { mapHistoryQueryToRecordsHref } from '../../lib/redirects/history-href';

export const metadata = {
  title: 'History',
  description: 'Browse BlackStory records by era, kind, status, and topic.',
};

type HistoryPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  permanentRedirect(mapHistoryQueryToRecordsHref(params));
}
