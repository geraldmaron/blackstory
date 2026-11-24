/**
 * Archive tab: the map with its list and filters behind one Map and List switch
 * (docs/ui/DESIGN.md sections 9.2 and 11). It is what the Explore and Records tabs were.
 *
 * The map view stands on ink in both themes; the list view is paper. The view, the filters, the
 * query and the selected record all ride the route params, so the two views read one filter
 * model and a link reopens the same view. The map camera and the device's position never enter
 * the address.
 *
 * This route file owns only the router surface: it validates params through the shared parser
 * and supplies navigation callbacks. `ExploreView` and `SearchScreen` stay router-free.
 */
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploreView, useExploreMapSource } from '@/features/explore';
import { SearchScreen } from '@/features/search';
import { filterStateToRouteParams, parseFilterState, parseSearchQuery } from '@/lib/route-params';
import type { ArchiveView } from '@/shell/mobile-nav';
import {
  CHROME_MAX_FONT_SCALE,
  DevMenuHeaderButton,
  Segmented,
  Text,
  brandCore,
  space,
  useThemeColors,
} from '@/ui';

const VIEWS = [
  { id: 'map', label: 'Map' },
  { id: 'list', label: 'List' },
] as const;

/** Anything but `list` is the map, so a malformed link still opens the Archive. */
export function parseArchiveView(raw: unknown): ArchiveView {
  return (Array.isArray(raw) ? raw[0] : raw) === 'list' ? 'list' : 'map';
}

export default function ArchiveTabScreen() {
  const rawParams = useLocalSearchParams();
  const view = parseArchiveView(rawParams.view);
  const filters = parseFilterState(rawParams as Record<string, unknown>);
  const mapSource = useExploreMapSource();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const onInk = view === 'map';
  const showList = () => router.setParams({ view: 'list' });

  return (
    <View style={[styles.root, { backgroundColor: onInk ? brandCore.ebonyInk : theme.canvas }]}>
      {focused && onInk ? <StatusBar style="light" /> : null}
      <View style={[styles.bar, { paddingTop: insets.top + space['2'] }]}>
        <Text
          variant="title"
          isHeading
          maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
          style={onInk ? { color: brandCore.archivePaper } : undefined}
        >
          Archive
        </Text>
        {__DEV__ ? <DevMenuHeaderButton /> : null}
        <Segmented
          options={VIEWS}
          value={view}
          onChange={(next) => router.setParams({ view: next })}
          accessibilityLabel="Archive view"
          testID="archive-view-switch"
        />
      </View>
      {onInk ? (
        <ExploreView
          edges={['left', 'right']}
          source={mapSource.source}
          loadState={mapSource.loadState}
          usingDemo={mapSource.usingDemo}
          onRetryMap={mapSource.retry}
          filters={filters}
          selectedParam={rawParams.selected}
          onOpenEntity={(id) => router.push({ pathname: '/entity/[id]', params: { id } })}
          onOpenStory={(slug) => router.push({ pathname: '/stories/[slug]', params: { slug } })}
          onOpenSearch={showList}
          onSelectionChange={(entityId) => router.setParams({ selected: entityId ?? '' })}
          onFiltersChange={(next) => router.setParams(filterStateToRouteParams(next))}
        />
      ) : (
        <SearchScreen
          initialQuery={parseSearchQuery(rawParams.q) || undefined}
          initialKind={filters.kind}
          initialEra={filters.era}
          pinnedRecordCount={
            mapSource.loadState.kind === 'ready' ? mapSource.source.features.length : undefined
          }
          archiveScopeLabel={mapSource.usingDemo ? 'Demo fixtures' : 'Active release'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    paddingHorizontal: space['4'],
    paddingBottom: space['2'],
  },
});
