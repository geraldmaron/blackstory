/**
 * Privacy-safe observability (MOB-018). Public surface — the rest of the app
 * imports from here, never from `native-bridge.ts` or an SDK package
 * directly (see `no-raw-sdk-imports.test.ts`).
 */
export { reportError, addBreadcrumb, startPerfTrace, reportPerf } from './crash-reporter';
export type { ReportErrorOptions, PerfTraceHandle } from './crash-reporter';

export { initializeObservability, resolveReportContext, refreshReportContext } from './bootstrap';
export type { ObservabilityInitResult } from './bootstrap';

export { buildReportContext, resolveRuntimeVersion, reportContextToAttributes } from './report-context';
export type { ReportContext, BuildReportContextInput } from './report-context';

export {
  resolveObservabilityConfig,
  shouldSamplePerfTrace,
  DEFAULT_OBSERVABILITY_ENABLED,
  DEFAULT_PERFORMANCE_SAMPLE_RATE,
} from './config';
export type { ObservabilityConfig } from './config';
