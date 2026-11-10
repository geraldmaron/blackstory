/**
 * The studio's in-editor preview: the same server-rendered preview, without the admin chrome.
 * A path of its own (not `?embed=1`) so the shell decides from the pathname on the server and
 * the client alike, and so framing can be allowed for exactly this route.
 */
import Preview from '../page';

export default async function EmbeddedPreview({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const query = await searchParams;
  return Preview({ params, searchParams: Promise.resolve({ ...query, embed: '1' }) });
}
