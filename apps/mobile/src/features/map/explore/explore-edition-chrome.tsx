/**
 * v6 Explore edition chrome primitives — segmented tabs, kickers, facet rows, and
 * panel headers. Mobile counterpart of web `explore-edition.css` + panel chrome.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LiftedSurface, Text, space, radius, useThemeColors, MIN_TOUCH_TARGET } from '@/ui';
import { exploreContentInset } from './explore-chrome';

const MIN_TOUCH = MIN_TOUCH_TARGET;

export type ExploreEditionTab = {
  readonly id: string;
  readonly label: string;
};

export type ExploreEditionSegmentTabsProps = {
  readonly tabs: readonly ExploreEditionTab[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

/** Segmented Filters | Color key — underline tabs, copper on active only. */
export function ExploreEditionSegmentTabs({
  tabs,
  activeId,
  onChange,
  accessibilityLabel = 'Map instruments',
  testID = 'explore-edition-tabs',
}: ExploreEditionSegmentTabsProps) {
  const theme = useThemeColors();

  return (
    <View
      style={[styles.segmentStrip, { borderBottomColor: theme.border }]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.segment,
              {
                borderBottomColor: selected ? theme.accent : 'transparent',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              variant="code"
              style={{
                color: selected ? theme.accent : theme.inkMuted,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                fontSize: 11,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type ExploreEditionKickerProps = {
  readonly children: string;
};

/** Mono copper slug above instrument body (e.g. "Map instruments"). */
export function ExploreEditionKicker({ children }: ExploreEditionKickerProps) {
  return (
    <Text variant="code" colorRole="accent" style={styles.kicker}>
      {children.toUpperCase()}
    </Text>
  );
}

export type ExploreFacetRowProps = {
  readonly label: string;
  readonly summary?: string;
  readonly children: ReactNode;
  readonly testID?: string;
};

/** Auto-apply facet row — mono label over a control slot (Kind, Era, …). */
export function ExploreFacetRow({ label, summary, children, testID }: ExploreFacetRowProps) {
  const theme = useThemeColors();

  return (
    <View
      style={[styles.facetRow, { borderBottomColor: theme.border }]}
      testID={testID}
    >
      <View style={styles.facetLabelBlock}>
        <Text variant="code" colorRole="inkMuted" style={styles.facetLabel}>
          {label.toUpperCase()}
        </Text>
        {summary ? (
          <Text variant="caption" colorRole="inkMuted" numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
      </View>
      <View style={styles.facetControl}>{children}</View>
    </View>
  );
}

export type ExplorePanelHeaderProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly onHide?: () => void;
  readonly hideLabel?: string;
  readonly testID?: string;
};

export function ExplorePanelHeader({
  title,
  subtitle,
  onHide,
  hideLabel = 'Hide panel',
  testID = 'explore-panel-header',
}: ExplorePanelHeaderProps) {
  return (
    <View style={styles.panelHeader} testID={testID}>
      <View style={styles.panelHeaderText}>
        <Text variant="code" colorRole="inkMuted" style={styles.panelTitle}>
          {title.toUpperCase()}
        </Text>
        {subtitle ? (
          <Text variant="caption" colorRole="inkMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onHide ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hideLabel}
          onPress={onHide}
          hitSlop={8}
          style={({ pressed }) => [
            styles.hideButton,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text variant="bodySmall" colorRole="accent">
            Hide
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type ExploreRestoreChipProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly testID?: string;
};

/** Collapsed-panel restore affordance (web restore dock). */
export function ExploreRestoreChip({
  label,
  onPress,
  selected = false,
  testID,
}: ExploreRestoreChipProps) {
  const theme = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.restoreChip,
        {
          backgroundColor: selected ? theme.surfaceRaised : theme.surface,
          borderColor: selected ? theme.accent : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text variant="code" style={{ color: selected ? theme.accent : theme.inkMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}

export type ExploreInstrumentsFrameProps = {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/**
 * Surface plate for in-map instruments — hairline Rule border, radius 8, flat
 * matte (Ledger Line; no decorative shadow).
 */
export function ExploreInstrumentsFrame({
  children,
  style,
  testID = 'explore-instruments-frame',
}: ExploreInstrumentsFrameProps) {
  return (
    <LiftedSurface
      tone="surface"
      shadow="none"
      radiusKey="sm"
      bordered
      style={[styles.instrumentsFrame, style]}
      testID={testID}
    >
      {children}
    </LiftedSurface>
  );
}

const styles = StyleSheet.create({
  segmentStrip: {
    flexDirection: 'row',
    gap: space['3'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: exploreContentInset,
  },
  segment: {
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    paddingHorizontal: space['1'],
    paddingBottom: space['1'],
    marginBottom: -StyleSheet.hairlineWidth,
  },
  kicker: {
    letterSpacing: 1,
  },
  facetRow: {
    paddingVertical: space['2'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space['2'],
  },
  facetLabelBlock: {
    gap: 2,
  },
  facetLabel: {
    letterSpacing: 0.4,
  },
  facetControl: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    paddingHorizontal: exploreContentInset,
    paddingTop: space['2'],
    paddingBottom: space['1'],
    minHeight: MIN_TOUCH,
  },
  panelHeaderText: {
    flex: 1,
    gap: 2,
  },
  panelTitle: {
    letterSpacing: 0.8,
  },
  hideButton: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreChip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: space['2'],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrumentsFrame: {
    maxHeight: '55%',
  },
});
