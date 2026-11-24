/**
 * `/opening`: the six-page opening. It is the first thing a new install sees (`(tabs)/index.tsx`
 * sends a first launch here) and it stays reachable from More.
 *
 * Skip, the last page's way in and a contents row all mark the opening as seen and replace this
 * screen, so Back never returns a reader to an opening they left.
 */
import { router } from 'expo-router';

import { markOpeningSeen, OpeningScreen } from '@/features/opening';

function leaveFor(route: `/${string}`) {
  void markOpeningSeen().catch(() => undefined);
  router.replace(route as never);
}

export default function OpeningRoute() {
  return (
    <OpeningScreen
      onDone={() => leaveFor('/archive')}
      onOpenRoute={leaveFor}
      onOpenRecord={(id) => router.push(`/entity/${id}`)}
      onReachedEnd={() => void markOpeningSeen().catch(() => undefined)}
    />
  );
}
