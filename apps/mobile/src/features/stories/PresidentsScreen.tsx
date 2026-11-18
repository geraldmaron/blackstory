/**
 * `/presidents`: every president on the record, in term order, from the live story list. A
 * collection, not a story: each entry has the same shape, and the set reads in one natural order.
 */
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  ErrorState,
  LedgerRow,
  LedgerSectionLabel,
  Notice,
  ScreenCanvas,
  ScreenHeader,
  space,
  useScreenScrollInsets,
} from '@/ui';
import { plainRangeText } from '../record-facts/record-facts';
import { collectionMembers } from './story-client';
import { storyHref } from './story-index';
import { useStoryList } from './use-stories';

export function PresidentsScreen() {
  const insets = useScreenScrollInsets();
  const { state, retry } = useStoryList();
  const presidents =
    state.kind === 'ready' ? collectionMembers(state.result.value.stories, 'presidents') : [];

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: insets.paddingHorizontal,
          paddingTop: space['4'],
          paddingBottom: insets.paddingBottom,
        }}
      >
        <View style={{ gap: insets.gap }}>
          <ScreenHeader
            kicker="Collections"
            title="Presidents"
            dek="Every president in term order, on slavery, civil rights and Black Americans, with the sources for each line."
            compact
            dense
          />
          {state.kind === 'loading' ? (
            <ActivityIndicator accessibilityLabel="Loading the presidents" style={{ margin: space['6'] }} />
          ) : null}
          {state.kind === 'offline-no-cache' ? (
            <ErrorState
              compact
              title="You’re offline"
              description="The list loads from the archive. Connect and try again."
              retry={{ label: 'Try again', onPress: () => void retry() }}
            />
          ) : null}
          {state.kind === 'error' || state.kind === 'not-found' ? (
            <ErrorState
              compact
              title="The list didn’t load"
              description={state.kind === 'error' ? state.message : undefined}
              retry={{ label: 'Try again', onPress: () => void retry() }}
            />
          ) : null}
          {state.kind === 'ready' ? (
            <View>
              {state.result.freshness.degraded ? (
                <Notice tone="info" title="Showing the list saved on this phone" compact />
              ) : null}
              <LedgerSectionLabel meta={`${presidents.length} entries`}>In term order</LedgerSectionLabel>
              {presidents.map((president, index) => (
                <LedgerRow
                  key={president.slug}
                  title={president.title}
                  slug={[president.collection?.positionLabel, plainRangeText(president.eraLabel)]
                    .filter(Boolean)
                    .join(' · ')}
                  showChevron
                  showDivider={index < presidents.length - 1}
                  onPress={() => router.push(storyHref(president) as never)}
                  accessibilityLabel={`${president.title}, ${president.collection?.positionLabel ?? ''}`}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenCanvas>
  );
}
