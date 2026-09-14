/**
 * The wide layout's records rail: a persistent pane beside the map, replacing the bottom
 * sheet that covers the map on a phone.
 *
 * The reason this is worth building rather than stretching the phone layout: on a phone,
 * selecting a pin REPLACES the list with the record preview, because there is no room for
 * both. That costs the reader their place in the list every time they look at something.
 * A tablet has the room, so here the preview appears above the list and the list stays —
 * a reader can step through six schools in a county and still see the six.
 *
 * The preview is capped at a little over half the rail and scrolls inside that cap, so a
 * record with a long story line and four "Cited in" entries cannot push the list off the
 * bottom of the pane. Below the cap it takes only the height it needs.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/ui';

/**
 * Share of the rail the record preview may take before it starts scrolling inside itself.
 * The list keeps the rest, and the rest is never less than a few rows.
 */
export const EXPLORE_RAIL_INSPECTOR_MAX_FRACTION = 0.55;

export type ExploreSideRailProps = {
  /** Pane width in dp, from `explorePaneLayout`. */
  readonly width: number;
  /** The selected record's preview. Omitted when nothing is selected. */
  readonly inspector?: ReactNode;
  /** The records list — mount `ExploreRecordsRail` with `listHost="plain"`. */
  readonly list: ReactNode;
  readonly testID?: string;
};

export function ExploreSideRail({
  width,
  inspector,
  list,
  testID = 'explore-side-rail',
}: ExploreSideRailProps) {
  const theme = useThemeColors();

  return (
    <View
      testID={testID}
      style={[
        styles.rail,
        { width, backgroundColor: theme.surface, borderLeftColor: theme.border },
      ]}
    >
      {inspector ? (
        <View
          testID="explore-side-rail-inspector"
          style={[styles.inspector, { borderBottomColor: theme.border }]}
        >
          <ScrollView
            // The preview is a fixed set of blocks, not a long document, so it is safe to
            // let it size itself and only scroll when the cap bites.
            contentContainerStyle={styles.inspectorContent}
            showsVerticalScrollIndicator={false}
          >
            {inspector}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.list}>{list}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  inspector: {
    maxHeight: `${EXPLORE_RAIL_INSPECTOR_MAX_FRACTION * 100}%`,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inspectorContent: {
    flexGrow: 1,
  },
  list: {
    flex: 1,
  },
});
