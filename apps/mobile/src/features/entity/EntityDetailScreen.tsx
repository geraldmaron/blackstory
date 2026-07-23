/**
 * Entity detail screen (MOB-014) — Ledger Line flat section stacks on canvas
 * matching web `design-direction-v6-entity.md`: intro, anatomy, trust off-ramp,
 * narrative beats, claims, timeline, connected records, provenance, maps hand-off.
 */
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ErrorState, screenScrollInsets, space, useThemeColors } from '@/ui';
import type { EntityDetailState } from './useEntityDetail';
import { entityBeatIndices } from './entity-beat-indices';
import { GENERIC_ERROR_COPY, OFFLINE_NO_CACHE_COPY } from './copy';
import { ClaimsSection } from './sections/ClaimsSection';
import { AnatomySection } from './sections/AnatomySection';
import { IntroSection } from './sections/IntroSection';
import { HowToReadThisRecord } from './sections/HowToReadThisRecord';
import { NarrativeSections } from './sections/NarrativeSections';
import { NotPublicState } from './sections/NotPublicState';
import { OfflineBanner } from './sections/OfflineBanner';
import { ProvenanceSection } from './sections/ProvenanceSection';
import { RelatedSection } from './sections/RelatedSection';
import { SensitivityBanner } from './sections/SensitivityBanner';
import { StatusSection } from './sections/StatusSection';
import { TimelineSection } from './sections/TimelineSection';

export type EntityDetailScreenProps = {
  readonly state: EntityDetailState;
  readonly isOnline?: boolean;
  readonly onRetry?: () => void;
  readonly onBackToExplore?: () => void;
  readonly onBackToMap?: (entityId: string) => void;
  readonly onOpenEntity?: (entityId: string) => void;
  readonly onMethodologyPress?: () => void;
};

export function EntityDetailScreen({
  state,
  isOnline = true,
  onRetry,
  onBackToExplore,
  onBackToMap,
  onOpenEntity,
  onMethodologyPress,
}: EntityDetailScreenProps) {
  const theme = useThemeColors();
  const canvasStyle = { flex: 1, backgroundColor: theme.canvas };
  // Every non-scrolling state (loading + the three terminal states) centers its single element so
  // they no longer visibly jump between top-left and center as the screen transitions.
  const centeredStateStyle = [
    canvasStyle,
    { alignItems: 'center' as const, justifyContent: 'center' as const, padding: space['8'] },
  ];

  if (state.kind === 'loading') {
    return (
      <View
        style={centeredStateStyle}
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
      <View style={centeredStateStyle} testID="entity-not-found-state">
        <NotPublicState onBackToExplore={onBackToExplore} />
      </View>
    );
  }

  if (state.kind === 'offline-no-cache') {
    return (
      <View style={centeredStateStyle} testID="entity-offline-no-cache-state">
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
      <View style={centeredStateStyle} testID="entity-error-state">
        <ErrorState
          title={GENERIC_ERROR_COPY.title}
          description={state.message || GENERIC_ERROR_COPY.description}
          retry={onRetry ? { label: GENERIC_ERROR_COPY.retry, onPress: onRetry } : undefined}
        />
      </View>
    );
  }

  const { entity, freshness } = state.result;
  const beats = entityBeatIndices(entity);

  return (
    <ScrollView
      testID="entity-detail-screen"
      style={canvasStyle}
      contentContainerStyle={{
        paddingHorizontal: screenScrollInsets.paddingHorizontal,
        paddingTop: screenScrollInsets.paddingTop,
        paddingBottom: screenScrollInsets.paddingBottom,
        gap: space['4'],
      }}
    >
      {freshness.degraded || entity.sensitivity ? (
        // Both trust banners lead the record together (differentiated tones), so the sensitivity
        // context frames the content it precedes instead of surfacing a screen-and-a-half later
        // as an apparent duplicate of the staleness banner.
        <View style={{ gap: space['2'] }}>
          {freshness.degraded ? <OfflineBanner fetchedAt={freshness.fetchedAt} /> : null}
          {entity.sensitivity ? <SensitivityBanner sensitivity={entity.sensitivity} /> : null}
        </View>
      ) : null}

      <IntroSection entity={entity} />

      <AnatomySection
        entity={entity}
        {...(onBackToMap ? { onBackToMap: () => onBackToMap(entity.id) } : {})}
      />

      <HowToReadThisRecord {...(onMethodologyPress ? { onMethodologyPress } : {})} />

      <NarrativeSections entity={entity} beats={beats} />
      <StatusSection entity={entity} index={beats.status} />
      <ClaimsSection claims={entity.claims} isOnline={isOnline} index={beats.claims} />
      {beats.timeline ? (
        <TimelineSection timeline={entity.timeline} index={beats.timeline} />
      ) : null}
      <RelatedSection
        relatedNeighbors={entity.relatedNeighbors ?? []}
        continueLearning={entity.continueLearning ?? []}
        index={beats.connected}
        {...(onOpenEntity ? { onOpenEntity } : {})}
      />
      <ProvenanceSection entity={entity} index={beats.provenance} />
    </ScrollView>
  );
}
