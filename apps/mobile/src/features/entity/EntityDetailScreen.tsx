/**
 * Entity detail screen (MOB-014) — a pure, state-in/props-out presentational component, the
 * same split `features/map/MapScreen.tsx` uses (the screen takes an already-resolved state; a
 * thin hook/route wrapper owns the real fetch). That split is what makes the adversarial
 * fixture matrix in `__tests__/EntityDetailScreen.test.tsx` exercise every case (missing
 * fields, malformed citation, withdrawn rights, zero claims, cyclic-reference neighbors,
 * malicious text, a maliciously large narrative, every entity kind) without mocking
 * SQLite/NetInfo/App Check per case — those are covered separately by
 * `dataClient.test.ts`/`useEntityDetail.test.ts` with injected fakes.
 *
 * Section order mirrors `apps/web/src/app/entity/[id]/page.tsx`: mast media → sensitivity
 * (additive, never suppressive) → relevance/context/further-reading → status/event-window →
 * accepted claims → timeline → connected records / continue learning → revision + maturity →
 * share.
 */
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ErrorState, Text, space } from '@/ui';
import type { EntityDetailState } from './useEntityDetail';
import { GENERIC_ERROR_COPY, OFFLINE_NO_CACHE_COPY } from './copy';
import { ClaimsSection } from './sections/ClaimsSection';
import { MastMedia } from './sections/MastMedia';
import { NarrativeSections } from './sections/NarrativeSections';
import { NotPublicState } from './sections/NotPublicState';
import { OfflineBanner } from './sections/OfflineBanner';
import { RelatedSection } from './sections/RelatedSection';
import { RevisionSection } from './sections/RevisionSection';
import { SensitivityBanner } from './sections/SensitivityBanner';
import { ShareButton } from './sections/ShareButton';
import { StatusSection } from './sections/StatusSection';
import { TimelineSection } from './sections/TimelineSection';
import { humanizeToken } from './format';

export type EntityDetailScreenProps = {
  readonly state: EntityDetailState;
  /** Current connectivity, used only for the citation-tap offline message. Defaults to true so
   * callers that don't care about this adversarial edge case get normal link behavior. */
  readonly isOnline?: boolean;
  readonly onRetry?: () => void;
  readonly onBackToExplore?: () => void;
  readonly onOpenEntity?: (entityId: string) => void;
};

export function EntityDetailScreen({
  state,
  isOnline = true,
  onRetry,
  onBackToExplore,
  onOpenEntity,
}: EntityDetailScreenProps) {
  if (state.kind === 'loading') {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space['8'] }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading record"
        testID="entity-loading-state"
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <View testID="entity-not-found-state">
        <NotPublicState onBackToExplore={onBackToExplore} />
      </View>
    );
  }

  if (state.kind === 'offline-no-cache') {
    return (
      <View testID="entity-offline-no-cache-state">
        <ErrorState
          title={OFFLINE_NO_CACHE_COPY.title}
          description={OFFLINE_NO_CACHE_COPY.description}
          retry={onRetry ? { label: OFFLINE_NO_CACHE_COPY.retry, onPress: onRetry } : undefined}
        />
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View testID="entity-error-state">
        <ErrorState
          title={GENERIC_ERROR_COPY.title}
          description={state.message || GENERIC_ERROR_COPY.description}
          retry={onRetry ? { label: GENERIC_ERROR_COPY.retry, onPress: onRetry } : undefined}
        />
      </View>
    );
  }

  const { entity, freshness } = state.result;

  return (
    <ScrollView
      testID="entity-detail-screen"
      contentContainerStyle={{ padding: space['4'], gap: space['6'] }}
    >
      {freshness.degraded ? <OfflineBanner fetchedAt={freshness.fetchedAt} /> : null}

      <MastMedia entity={entity} />

      {entity.topicTags.length > 0 ? (
        <Text variant="caption" colorRole="inkMuted">
          {entity.topicTags.map((tag) => humanizeToken(tag)).join(' · ')}
        </Text>
      ) : null}

      {entity.sensitivity ? <SensitivityBanner sensitivity={entity.sensitivity} /> : null}

      <NarrativeSections entity={entity} />
      <StatusSection entity={entity} />
      <ClaimsSection claims={entity.claims} isOnline={isOnline} />
      <TimelineSection timeline={entity.timeline} />
      <RelatedSection
        relatedNeighbors={entity.relatedNeighbors ?? []}
        continueLearning={entity.continueLearning ?? []}
        onOpenEntity={onOpenEntity}
      />
      <RevisionSection entity={entity} />
      <ShareButton entityId={entity.id} displayName={entity.displayName} />
    </ScrollView>
  );
}
