/**
 * Instant loading state for `/explore`.
 *
 * The route is `force-dynamic` (see page.tsx): a cold instance first has to load its catalog,
 * which can take seconds, and without this file Next shows nothing while that streams. It shows
 * the same column placeholder the atlas chunk uses, so the hand-off is one picture, not a spinner
 * followed by a layout.
 */
import { AtlasPending } from './AtlasPending';

export default function ExploreLoading() {
  return <AtlasPending />;
}
