/**
 * Entity detail screen (MOB-014) — Ledger Line flat section stacks on canvas.
 *
 * Section order aligns to web's canonical `recordSectionIndex`
 * (`apps/web/src/app/entity/[id]/EntityRoomSections.tsx`) for the beats the two platforms
 * share: intro, anatomy and trust off-ramp (layout-only on this screen — web renders the same
 * material in its masthead and fact strip, not as a numbered beat), narrative beats, claims,
 * status, timeline, connected records, cited-in (web's "Where this record is written about"),
 * provenance (layout-only, same reasoning as intro/anatomy), maps hand-off, and optional
 * session navigation footer.
 */
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ErrorState, screenScrollInsets, space, useThemeColors } from '@/ui';
import { markPerf } from '@/lib/perf-marks';
import type { EntityDetailState } from './useEntityDetail';
import { CiteButton } from '@/features/cite/CiteButton';
import { GENERIC_ERROR_COPY, OFFLINE_NO_CACHE_COPY } from './copy';
import { buildCanonicalEntityUrl, CANONICAL_WEB_ORIGIN } from './share';
import { CitedInSection } from './sections/CitedInSection';
import { ClaimsSection } from './sections/ClaimsSection';
import { AnatomySection, RecordMapSection } from './sections/AnatomySection';
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
  /** Opens a published story by slug — the record's "Cited in" beat is the only caller. */
  readonly onOpenStory?: (slug: string) => void;
  readonly onMethodologyPress?: () => void;
  /** Optional session Previous / Next / Random footer (web EntitySessionNav parity). */
  readonly sessionNav?: ReactNode;
};

export function EntityDetailScreen({
  state,
  isOnline = true,
  onRetry,
  onBackToExplore,
  onBackToMap,
  onOpenEntity,
  onOpenStory,
  onMethodologyPress,
  sessionNav,
}: EntityDetailScreenProps) {
  const theme = useThemeColors();
  const canvasStyle = { flex: 1, backgroundColor: theme.canvas };
  // Every non-scrolling state (loading + the three terminal states) centers its single element so
  // they no longer visibly jump between top-left and center as the screen transitions.
  const centeredStateStyle = [
    canvasStyle,
    { alignItems: 'center' as const, justifyContent: 'center' as const, padding: space['8'] },
  ];

  // Hooks run unconditionally, ahead of the early returns below, per the rules of hooks. `ready`
  // is every state that falls through to the real record render (i.e. neither loading nor one of
  // the three terminal non-record states).
  const ready =
    state.kind !== 'loading' &&
    state.kind !== 'not-found' &&
    state.kind !== 'offline-no-cache' &&
    state.kind !== 'error';
  useEffect(() => {
    if (ready) markPerf('entity_detail_loaded');
  }, [ready]);

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
  const mapSection = (
    <RecordMapSection
      entity={entity}
      {...(onBackToMap ? { onBackToMap: () => onBackToMap(entity.id) } : {})}
    />
  );

  // Phone order (docs/ui/DESIGN.md section 9.1): exhibit, name, summary, facts, claims, map,
  // the rest. The photograph leads; with none, the map does.
  return (
    <ScrollView
      testID="entity-detail-screen"
      style={canvasStyle}
      contentContainerStyle={{
        paddingHorizontal: screenScrollInsets.paddingHorizontal,
        paddingTop: screenScrollInsets.paddingTop,
        paddingBottom: screenScrollInsets.paddingBottom,
        gap: space['5'],
      }}
    >
      {freshness.degraded || entity.sensitivity ? (
        <View style={{ gap: space['2'] }}>
          {freshness.degraded ? <OfflineBanner fetchedAt={freshness.fetchedAt} /> : null}
          {entity.sensitivity ? <SensitivityBanner sensitivity={entity.sensitivity} /> : null}
        </View>
      ) : null}

      <IntroSection entity={entity} {...(entity.primaryImage ? {} : { lead: mapSection })} />
      {/* The page's date is its last revision; the subject's years never enter a citation. */}
      <CiteButton
        source={{
          title: entity.displayName,
          url: buildCanonicalEntityUrl(entity.id) ?? CANONICAL_WEB_ORIGIN,
          published: entity.revision.recordUpdatedAt,
        }}
      />
      <AnatomySection entity={entity} />
      <ClaimsSection claims={entity.claims} isOnline={isOnline} />
      {entity.primaryImage ? mapSection : null}

      <NarrativeSections entity={entity} />
      <StatusSection entity={entity} />
      <TimelineSection timeline={entity.timeline} />
      <RelatedSection
        relatedNeighbors={entity.relatedNeighbors ?? []}
        continueLearning={entity.continueLearning ?? []}
        {...(onOpenEntity ? { onOpenEntity } : {})}
      />
      <CitedInSection
        citingStories={entity.citingStories ?? []}
        {...(onOpenStory ? { onOpenStory } : {})}
      />
      <ProvenanceSection entity={entity} />
      <HowToReadThisRecord {...(onMethodologyPress ? { onMethodologyPress } : {})} />
      {sessionNav ?? null}
    </ScrollView>
  );
}
