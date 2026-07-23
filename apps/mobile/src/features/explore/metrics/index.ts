/**
 * Explore metrics dashboard: aggregations and compact visualizations for the
 * map bottom sheet (kind mix, places, era, precision honesty, scope compare).
 */
export {
  aggregateExploreMetrics,
  metricsAccessibilitySummary,
  type AggregateExploreMetricsOptions,
  type ExploreMetrics,
  type MetricBucket,
  type PrecisionHonesty,
  type ScopeComparison,
} from './aggregate-explore-metrics';
export { ExploreMetricsDashboard, type ExploreMetricsDashboardProps } from './ExploreMetricsDashboard';
export { MetricBarRow, type MetricBarRowProps } from './MetricBarRow';
export { MetricStatRow, type MetricStatRowProps } from './MetricStatRow';
