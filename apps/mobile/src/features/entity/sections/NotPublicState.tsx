/**
 * Dignified "not currently public" state — used for BOTH a withdrawn entity and an id that
 * never existed.
 *
 * WHY ONE STATE, NOT TWO: `apps/api-public/src/http/handlers.ts`'s `handleEntity` returns an
 * IDENTICAL `NOT_FOUND` response for a nonexistent id and an unpublished/withdrawn one — quote
 * from that handler: "IDENTICAL 404 for nonexistent AND unpublished — a client must not
 * distinguish them (T3)". That is a deliberate anti-enumeration control (threat-model T3: an
 * attacker walking ids must not learn which ones used to be public), so this screen has no
 * signal to distinguish the two cases even in principle and must not pretend otherwise. What
 * this component fixes relative to a bare generic error is TONE: this is the CALM, EXPECTED
 * "this isn't here" case (not a scary red alert), distinct from `ErrorState` (network/server
 * failure) and the offline-no-cache case, both of which ARE unexpected failures worth a retry
 * affordance.
 */
import { EmptyState } from '@/ui';
import { NOT_PUBLIC_COPY } from '../copy';

export type NotPublicStateProps = {
  readonly onBackToExplore?: () => void;
};

export function NotPublicState({ onBackToExplore }: NotPublicStateProps) {
  return (
    <EmptyState
      title={NOT_PUBLIC_COPY.title}
      description={NOT_PUBLIC_COPY.body}
      action={onBackToExplore ? { label: NOT_PUBLIC_COPY.action, onPress: onBackToExplore } : undefined}
    />
  );
}
