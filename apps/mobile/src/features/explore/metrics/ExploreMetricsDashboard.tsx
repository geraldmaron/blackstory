/**
 * Default Explore bottom-sheet content: metrics and compact visualizations for
 * the visible / filtered FeatureCollection. Entity list stays secondary
 * (expandable). Pin selection still swaps this for EntityPreviewSheet upstream.
 *
 * Aggregates kind mix %, top places, precision honesty, era coverage, and
 * optional viewport-vs-national comparison from properties already on features.
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
  /**
   * Full filtered release set when `features` is viewport-clipped, enabling
   * in-view vs national comparison. Omit when the scope is already national.
   */
  readonly nationalFeatures?: readonly ExploreFeature[];
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
  emphasizeLeading = false,
}: {
  readonly title: string;
  readonly buckets: readonly MetricBucket[];
  readonly testID: string;
  readonly emphasizeLeading?: boolean;
}) {
  if (buckets.length === 0) return null;
  const max = maxCount(buckets);

  return (
    <View style={styles.section} testID={testID}>
      <Text variant="code" colorRole="inkMuted" accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.bars}>
        {buckets.map((bucket, index) => (
          <MetricBarRow
            key={bucket.key}
            label={bucket.label}
            count={bucket.count}
            maxCount={max}
            percent={bucket.percent}
            emphasize={emphasizeLeading && index === 0}
            testID={`${testID}-${bucket.key}`}
          />
        ))}
      </View>
    </View>
  );
}

export function ExploreMetricsDashboard({
  features,
  nationalFeatures,
  scopeLabel,
  selectedId,
  onSelectFeature,
  onUserScroll,
  onOpenSearch,
  reduceMotion: _reduceMotion = false,
}: ExploreMetricsDashboardProps) {
  const theme = useThemeColors();
  const [listExpanded, setListExpanded] = useState(false);
  const metrics = useMemo(
    () => aggregateExploreMetrics(features, { nationalFeatures }),
    [features, nationalFeatures],
  );
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

  const honesty = metrics.precisionHonesty;
  const comparison = metrics.comparison;

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
        {comparison ? (
          <Text
            variant="caption"
            colorRole="inkMuted"
            testID="explore-metrics-comparison"
            accessibilityLabel={`${comparison.shareOfNationalPercent}% of ${comparison.nationalTotal} records nationally`}
          >
            {comparison.shareOfNationalPercent}% of {comparison.nationalTotal} nationally
            {comparison.geographySharePercent != null
              ? ` · ${metrics.geographyCoverage} of ${comparison.nationalGeography} places`
              : ''}
          </Text>
        ) : null}
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
          value={
            metrics.eraCoveragePercent != null ? `${metrics.eraCoveragePercent}%` : '—'
          }
          label="Era-labeled"
          accessibilityLabel={
            metrics.eraCoveragePercent != null
              ? `${metrics.eraCoveragePercent}% of records have era labels`
              : 'No era coverage'
          }
          testID="explore-metric-era-labeled"
        />
        <MetricStatRow
          value={
            honesty.cityOrCoarserPercent != null
              ? `${honesty.cityOrCoarserPercent}%`
              : '—'
          }
          label="City+"
          accessibilityLabel={
            honesty.cityOrCoarserPercent != null
              ? `${honesty.cityOrCoarserPercent}% of records at city or coarser precision`
              : 'No precision labels'
          }
          showEdge={false}
          testID="explore-metric-precision-honesty"
        />
      </View>

      <BucketSection
        title="Kind mix"
        buckets={metrics.byKind}
        testID="explore-metrics-by-kind"
        emphasizeLeading
      />
      <BucketSection
        title="Top places"
        buckets={metrics.byState}
        testID="explore-metrics-by-state"
      />
      <BucketSection title="By era" buckets={metrics.byEra} testID="explore-metrics-by-era" />
      <BucketSection
        title="Location precision"
        buckets={metrics.byPrecision}
        testID="explore-metrics-by-precision"
      />

      {honesty.labeled > 0 ? (
        <View
          style={[styles.honestyNote, { borderColor: theme.border }]}
          testID="explore-metrics-precision-note"
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${honesty.cityOrCoarser} city or coarser, ${honesty.sharperThanCity} sharper than city, of ${honesty.labeled} labeled`}
        >
          <Text variant="code" colorRole="inkMuted">
            Precision honesty
          </Text>
          <Text variant="caption" colorRole="inkMuted">
            {honesty.cityOrCoarser} city or coarser · {honesty.sharperThanCity} sharper than
            city (of {honesty.labeled} labeled). Points never claim a sharper pin than stored
            precision.
          </Text>
        </View>
      ) : null}

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
    gap: space['1'],
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
  honestyNote: {
    gap: space['1'],
    paddingVertical: space['2'],
    paddingHorizontal: space['2'],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
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
