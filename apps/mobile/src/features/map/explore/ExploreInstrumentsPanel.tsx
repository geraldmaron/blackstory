/**
 * v6 Explore instruments chassis — tabbed Filters | Color key in an opaque Surface
 * panel over the map. Auto-applies filter changes via callback (no Apply footer).
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@/ui';
import type { FilterState } from '@/lib/route-params';
import type { ExploreFeature } from '@/features/explore/explore-feature';
import { buildExploreFacetOptions } from '@/features/explore/explore-filter';
import { MapColorKey } from './MapColorKey';
import { ExploreFiltersPanel } from './ExploreFiltersPanel';
import { exploreContentInset } from './explore-chrome';
import {
  ExploreEditionSegmentTabs,
  ExploreInstrumentsFrame,
  ExplorePanelHeader,
} from './explore-edition-chrome';

export type ExploreInstrumentsTab = 'filters' | 'key';

export type ExploreInstrumentsPanelProps = {
  readonly filters: FilterState;
  readonly features: readonly ExploreFeature[];
  readonly onFiltersChange: (filters: FilterState) => void;
  readonly onHide: () => void;
  readonly onOpenPlaceFind?: () => void;
  readonly initialTab?: ExploreInstrumentsTab;
  readonly testID?: string;
};

const TABS = [
  { id: 'filters', label: 'Filters' },
  { id: 'key', label: 'Color key' },
] as const;

export function ExploreInstrumentsPanel({
  filters,
  features,
  onFiltersChange,
  onHide,
  onOpenPlaceFind,
  initialTab = 'filters',
  testID = 'explore-instruments-panel',
}: ExploreInstrumentsPanelProps) {
  const [tab, setTab] = useState<ExploreInstrumentsTab>(initialTab);
  const facetOptions = useMemo(() => buildExploreFacetOptions(features), [features]);

  return (
    <ExploreInstrumentsFrame style={styles.frame} testID={testID}>
      <ExplorePanelHeader
        title="Map instruments"
        onHide={onHide}
        hideLabel="Hide map instruments"
      />

      <View style={styles.tabBar}>
        <ExploreEditionSegmentTabs
          tabs={TABS}
          activeId={tab}
          onChange={(id) => setTab(id as ExploreInstrumentsTab)}
        />
      </View>

      {tab === 'filters' ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filtersBody}
          testID="explore-instruments-filters"
        >
          <ExploreFiltersPanel
            filters={filters}
            facetOptions={facetOptions}
            mode="embedded"
            onFiltersChange={onFiltersChange}
            onClear={() => onFiltersChange({})}
            onApply={() => undefined}
            onOpenPlaceFind={onOpenPlaceFind}
            description="Narrow the map and records rail. Changes apply immediately."
          />
        </ScrollView>
      ) : (
        <View style={styles.keyBody} testID="explore-instruments-color-key">
          <MapColorKey embedded />
        </View>
      )}
    </ExploreInstrumentsFrame>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 0,
  },
  tabBar: {
    paddingVertical: space['2'],
  },
  filtersBody: {
    paddingHorizontal: exploreContentInset,
    paddingBottom: space['4'],
    gap: space['2'],
  },
  keyBody: {
    flex: 1,
    maxHeight: 320,
  },
});
