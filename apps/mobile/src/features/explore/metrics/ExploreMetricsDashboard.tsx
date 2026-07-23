/**
 * Default Explore bottom-sheet content: metrics and compact visualizations for
 * the visible / filtered FeatureCollection. Entity list stays secondary
 * (expandable). Pin selection still swaps this for EntityPreviewSheet upstream.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  SectionHeader,
  Text,
  radius,
  space,
  useThemeColors,
} from '@/ui';
import { ExploreList } from '../ExploreList';
import type { ExploreFeature } from '../explore-feature';
import {
  aggregateExploreMetrics,
  metricsAccessibilitySummary,
  type MetricBucket,
} from './aggregate-explore-metrics';
import { MetricBarRow } from './MetricBarRow';
import { MetricStatRow } from './MetricStatRow';

export type ExploreMetricsDashboardProps = {
  readonly features: readonly ExploreFeature[];
  /** e.g. "In view" when viewport-clipped, "All records" before first region. */
  readonly scopeLabel: string;
  readonly selectedId?: string;
  readonly onSelectFeature: (feature: ExploreFeature) => void;
  readonly onUserScroll?: () => void;
  readonly onOpenSearch?: () => void;
  /**
   * When true, the dashboard avoids motion-dependent presentation. Bars are
   * already static widths; retained so callers can pass the OS preference.
   */
  readonly reduceMotion?: boolean;
};

function maxCount(buckets: readonly MetricBucket[]): number {
  let max = 0;
  for (const bucket of buckets) {
    if (bucket.count > max) max = bucket.count;
  }
  return max;
}

function BucketSection({
  title,
  buckets,
  testID,
}: {
  readonly title: string;
  readonly buckets: readonly MetricBucket[];
  readonly testID: string;
}) {
  if (buckets.length === 0) return null;
  const max = maxCount(buckets);

  return (
    <View style={styles.section} testID={testID}>
      <Text variant="code" colorRole="inkMuted" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.bars}>
        {buckets.map((bucket) => (
          <MetricBarRow
            key={bucket.key}
            label={bucket.label}
            count={bucket.count}
            maxCount={max}
            testID={`${testID}-${bucket.key}`}
          />
        ))}
      </View>
    </View>
  );
}

export function ExploreMetricsDashboard({
  features,
  scopeLabel,
  selectedId,
  onSelectFeature,
  onUserScroll,
  onOpenSearch,
  reduceMotion: _reduceMotion = false,
}: ExploreMetricsDashboardProps) {
  const theme = useThemeColors();
  const [listExpanded, setListExpanded] = useState(false);
  const metrics = useMemo(() => aggregateExploreMetrics(features), [features]);
  const summary = useMemo(
    () => metricsAccessibilitySummary(metrics, scopeLabel),
    [metrics, scopeLabel],
  );

  if (metrics.total === 0) {
    return (
      <View style={styles.root} testID="explore-metrics-dashboard">
        <View testID="explore-metrics-empty" style={styles.emptyWrap}>
          <EmptyState
            title="No records in this view"
            description="Pan or zoom the map, or clear a filter, to see counts and presence here."
          />
        </View>
        {onOpenSearch ? (
          <View style={styles.searchLink}>
            <Button
              label="Browse in Search"
              variant="ghost"
              density="compact"
              onPress={onOpenSearch}
              accessibilityLabel="Browse records in Search"
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="explore-metrics-dashboard"
      keyboardShouldPersistTaps="handled"
    >
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={summary}
        style={styles.summaryBlock}
      >
        <SectionHeader
          meta={scopeLabel}
          title={metrics.total === 1 ? '1 record' : `${metrics.total} records`}
          headingScale="bodyEmphasis"
        />
      </View>

      <View
        style={[styles.statStrip, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
        testID="explore-metrics-presence"
      >
        <MetricStatRow
          value={String(metrics.total)}
          label="Records"
          accessibilityLabel={`${metrics.total === 1 ? '1 record' : `${metrics.total} records`} ${scopeLabel.toLowerCase()}`}
          testID="explore-metric-total"
        />
        <MetricStatRow
          value={String(metrics.geographyCoverage)}
          label="Places"
          accessibilityLabel={`${metrics.geographyCoverage === 1 ? '1 place' : `${metrics.geographyCoverage} places`} with records`}
          testID="explore-metric-geography"
        />
        <MetricStatRow
          value={String(metrics.byKind.length)}
          label="Kinds"
          accessibilityLabel={`${metrics.byKind.length === 1 ? '1 kind' : `${metrics.byKind.length} kinds`} represented`}
          testID="explore-metric-kinds"
        />
        <MetricStatRow
          value={String(metrics.withEraLabeled)}
          label="Era-labeled"
          accessibilityLabel={`${metrics.withEraLabeled === 1 ? '1 record' : `${metrics.withEraLabeled} records`} with era labels`}
          showEdge={false}
          testID="explore-metric-era-labeled"
        />
      </View>

      <BucketSection title="By kind" buckets={metrics.byKind} testID="explore-metrics-by-kind" />
      <BucketSection title="By place" buckets={metrics.byState} testID="explore-metrics-by-state" />
      <BucketSection title="By era" buckets={metrics.byEra} testID="explore-metrics-by-era" />
      <BucketSection
        title="Location precision"
        buckets={metrics.byPrecision}
        testID="explore-metrics-by-precision"
      />

      <View style={[styles.listSection, { borderTopColor: theme.border }]}>
        <Button
          label={listExpanded ? 'Hide records' : 'Show records'}
          variant="ghost"
          density="compact"
          accessibilityLabel={
            listExpanded
              ? 'Hide record list'
              : `Show record list, ${metrics.total} ${metrics.total === 1 ? 'record' : 'records'}`
          }
          accessibilityState={{ expanded: listExpanded }}
          onPress={() => setListExpanded((open) => !open)}
          testID="explore-metrics-list-toggle"
        />

        {listExpanded ? (
          <View style={styles.listBody} testID="explore-metrics-list-panel">
            <ExploreList
              features={features}
              selectedId={selectedId}
              onSelect={onSelectFeature}
              onUserScroll={onUserScroll}
            />
          </View>
        ) : null}

        {!listExpanded && onOpenSearch ? (
          <Button
            label="Browse in Search"
            variant="ghost"
            density="compact"
            onPress={onOpenSearch}
            accessibilityLabel="Browse records in Search"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space['3'],
    paddingBottom: space['4'],
    gap: space['3'],
  },
  summaryBlock: {
    paddingTop: space['1'],
  },
  statStrip: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  section: {
    gap: space['2'],
  },
  bars: {
    gap: space['2'],
  },
  listSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space['2'],
    gap: space['2'],
    minHeight: 48,
  },
  listBody: {
    minHeight: 160,
    maxHeight: 280,
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: space['3'],
    paddingTop: space['2'],
  },
  searchLink: {
    paddingHorizontal: space['3'],
    paddingBottom: space['3'],
  },
});
