/**
 * Crash / performance reporting — the ONLY sanctioned path from app code to
 * the crash SDK (MOB-018; privacy invariant 7).
 *
 * `reportError`, `addBreadcrumb`, `startPerfTrace`, and `reportPerf` are the
 * complete public surface. The rest of the app must NEVER import
 * `@react-native-firebase/crashlytics` / `@react-native-firebase/perf`
 * directly — that would bypass the redaction pipeline this module exists to
 * enforce. (`no-raw-sdk-imports.test.ts` greps the source tree for that.)
 *
 * Every context object passed in here is redacted through
 * `src/security/log-redaction.ts` — the SAME utility MOB-010 built and
 * tested, not a reimplementation — before it can reach the native SDK, then
 * size-capped so an unbounded payload never ships. Every call is wrapped in
 * its own try/catch, and the whole exported function is wrapped again, so:
 *
 *   - a missing/misconfigured/throwing native SDK degrades silently (bead
 *     requirement 5: "graceful SDK failure" — the app must keep working);
 *   - a bug in THIS reporter's own code (the adversarial "crash inside the
 *     logger itself" case) can never propagate and crash the caller.
 *
 * Release/build metadata (bead requirement 3) is attached automatically via
 * `report-context.ts`'s `buildReportContext()` — callers never need to
 * remember to pass it.
 */

import { redactForLog } from '../security/log-redaction';
import {
  DEFAULT_OBSERVABILITY_ENABLED,
  DEFAULT_PERFORMANCE_SAMPLE_RATE,
  shouldSamplePerfTrace,
  type ObservabilityConfig,
} from './config';
import {
  loadNativeCrashlytics,
  loadNativePerf,
  type NativeCrashlyticsSurface,
  type NativePerfSurface,
  type NativePerfTrace,
} from './native-bridge';
import { reportContextToAttributes, type ReportContext } from './report-context';

/** Any single breadcrumb/context payload larger than this (as redacted JSON
 * text) is truncated rather than sent unbounded (bead requirement 9). */
export const MAX_CONTEXT_SERIALIZED_BYTES = 8 * 1024;

/** Any single breadcrumb message string longer than this is truncated. */
export const MAX_BREADCRUMB_MESSAGE_LENGTH = 1000;

const UNSET_REPORT_CONTEXT: ReportContext = {
  appVersion: 'unknown',
  buildNumber: 'unknown',
  runtimeVersion: 'unknown',
  releaseId: 'unknown',
  schemaVersion: -1,
  platform: 'unknown',
  platformVersion: 'unknown',
  appVariant: 'development',
  degraded: false,
};

let activeReportContext: ReportContext = UNSET_REPORT_CONTEXT;
let activeConfig: ObservabilityConfig = {
  observabilityEnabled: DEFAULT_OBSERVABILITY_ENABLED,
  performanceSampleRate: DEFAULT_PERFORMANCE_SAMPLE_RATE,
};

let cachedCrashlytics: NativeCrashlyticsSurface | null | undefined;
let cachedPerf: NativePerfSurface | null | undefined;

/** Called once at bootstrap (see `bootstrap.ts`) whenever the resolved
 * report context changes (e.g. release stamp / connectivity update). */
export function setActiveReportContext(context: ReportContext): void {
  activeReportContext = context;
}

export function getActiveReportContext(): ReportContext {
  return activeReportContext;
}

/** Called once at bootstrap with the resolved kill-switch/sampling config. */
export function setObservabilityConfig(config: ObservabilityConfig): void {
  activeConfig = config;
}

export function getObservabilityConfig(): ObservabilityConfig {
  return activeConfig;
}

export interface ReportDeps {
  readonly getCrashlytics?: () => NativeCrashlyticsSurface | null;
  readonly getPerf?: () => NativePerfSurface | null;
}

function resolveCrashlytics(deps?: ReportDeps): NativeCrashlyticsSurface | null {
  if (deps?.getCrashlytics) {
    return deps.getCrashlytics();
  }
  if (cachedCrashlytics === undefined) {
    cachedCrashlytics = loadNativeCrashlytics();
  }
  return cachedCrashlytics;
}

function resolvePerf(deps?: ReportDeps): NativePerfSurface | null {
  if (deps?.getPerf) {
    return deps.getPerf();
  }
  if (cachedPerf === undefined) {
    cachedPerf = loadNativePerf();
  }
  return cachedPerf;
}

/** Test-only seam: clear module state between tests. */
export function __resetObservabilityForTests(): void {
  activeReportContext = UNSET_REPORT_CONTEXT;
  activeConfig = {
    observabilityEnabled: DEFAULT_OBSERVABILITY_ENABLED,
    performanceSampleRate: DEFAULT_PERFORMANCE_SAMPLE_RATE,
  };
  cachedCrashlytics = undefined;
  cachedPerf = undefined;
}

function truncateString(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…[truncated ${text.length - max} more chars]`;
}

/**
 * Redact, then size-cap, an arbitrary context payload. Redaction runs FIRST
 * so a truncated preview can never contain a partial sensitive value
 * (`log-redaction.ts`'s own "redaction is whole-value" discipline extends
 * here: we only ever truncate already-safe text). Reuses `redactForLog`'s
 * existing depth+`WeakSet` cycle guard (see log-redaction.ts) rather than
 * re-implementing circular-reference handling — the same defensive pattern
 * MOB-015's `normalizeContentPage` relies on for circular content bodies.
 */
export function redactAndCapContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (context === undefined) {
    return undefined;
  }

  let redacted: unknown;
  try {
    redacted = redactForLog(context);
  } catch {
    // Even the redactor failing must not block reporting the underlying
    // error — fall back to an empty, safe context.
    return { contextRedactionFailed: true };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(redacted) ?? '';
  } catch {
    return { contextSerializationFailed: true };
  }

  if (serialized.length <= MAX_CONTEXT_SERIALIZED_BYTES) {
    return isPlainObject(redacted) ? redacted : { value: redacted };
  }

  return {
    contextTruncated: true,
    originalSerializedLength: serialized.length,
    preview: truncateString(serialized, MAX_CONTEXT_SERIALIZED_BYTES),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeToError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  try {
    return new Error(typeof error === 'string' ? error : JSON.stringify(error));
  } catch {
    return new Error('Non-serializable error value reported');
  }
}

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Never let a native SDK call's failure escape this module.
  }
}

async function safelyAsync(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Same contract as `safely`, for promise-returning native calls.
  }
}

export interface ReportErrorOptions {
  readonly context?: Record<string, unknown>;
  /** Marks the report as a fatal (app-crashing) event vs. a handled/caught one. */
  readonly fatal?: boolean;
}

/**
 * Report an error/exception to the crash SDK. This function NEVER throws —
 * every failure mode (redaction failure, absent SDK, native SDK throwing,
 * even a bug in this function's own body) degrades to a no-op.
 *
 * `deps` is a test-only seam (mirrors `initializeAppCheckClient`'s
 * `loadNative` override in `src/security/app-check.ts`): production call
 * sites never pass it, so the real, module-cached, guarded loader is always
 * used in the app.
 */
export function reportError(
  error: unknown,
  options: ReportErrorOptions = {},
  deps?: ReportDeps,
): void {
  try {
    if (!activeConfig.observabilityEnabled) {
      return;
    }

    const native = resolveCrashlytics(deps);
    if (!native) {
      return;
    }

    const normalizedError = normalizeToError(error);
    const mergedContext = redactAndCapContext({
      ...reportContextToAttributes(activeReportContext),
      fatal: String(options.fatal ?? false),
      ...options.context,
    });

    if (mergedContext) {
      safely(() => {
        void native.setAttributes(stringifyAttributeValues(mergedContext));
      });
    }
    safely(() => native.recordError(normalizedError));
  } catch {
    // Defensive outer guard (bead requirement: a crash INSIDE the reporter's
    // own code must not crash the app further).
  }
}

/**
 * Attach a lightweight breadcrumb (not a full error) to the crash timeline.
 * Same redaction + size-cap + never-throw contract as `reportError`.
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
  deps?: ReportDeps,
): void {
  try {
    if (!activeConfig.observabilityEnabled) {
      return;
    }
    const native = resolveCrashlytics(deps);
    if (!native) {
      return;
    }

    const safeMessage = truncateString(
      redactSingleString(message),
      MAX_BREADCRUMB_MESSAGE_LENGTH,
    );
    const safeData = redactAndCapContext(data);
    const line = safeData ? `${safeMessage} ${JSON.stringify(safeData)}` : safeMessage;

    safely(() => native.log(truncateString(line, MAX_BREADCRUMB_MESSAGE_LENGTH)));
  } catch {
    // See reportError — never propagate.
  }
}

function redactSingleString(value: string): string {
  try {
    const redacted = redactForLog(value);
    return typeof redacted === 'string' ? redacted : String(redacted);
  } catch {
    return '[redaction-failed]';
  }
}

function stringifyAttributeValues(
  record: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
  }
  return out;
}

export interface PerfTraceHandle {
  putAttribute(key: string, value: string): void;
  stop(): Promise<void>;
}

const NOOP_TRACE_HANDLE: PerfTraceHandle = {
  putAttribute: () => {},
  stop: async () => {},
};

function sanitizeTraceName(name: string): string {
  // Trace names are identifiers, not free text, but cap length defensively —
  // Crashlytics/Performance both reject overlong metric/trace names.
  return truncateString(redactSingleString(name), 100).replace(/[^\w.\-/ ]/g, '_');
}

/**
 * Start a sampled performance trace. Sampling (bead requirement 6) applies
 * BEFORE any native call — an unsampled trace never touches the SDK at all,
 * which is also how this stays a true no-op (not just a no-report) when
 * observability is disabled or the SDK is absent.
 */
export async function startPerfTrace(
  name: string,
  context?: Record<string, unknown>,
  deps?: ReportDeps,
): Promise<PerfTraceHandle> {
  try {
    if (!activeConfig.observabilityEnabled) {
      return NOOP_TRACE_HANDLE;
    }
    if (!shouldSamplePerfTrace(activeConfig.performanceSampleRate)) {
      return NOOP_TRACE_HANDLE;
    }
    const native = resolvePerf(deps);
    if (!native) {
      return NOOP_TRACE_HANDLE;
    }

    let trace: NativePerfTrace;
    try {
      trace = native.newTrace(sanitizeTraceName(name));
      await trace.start();
    } catch {
      return NOOP_TRACE_HANDLE;
    }

    const safeContext = redactAndCapContext({
      ...reportContextToAttributes(activeReportContext),
      ...context,
    });
    if (safeContext) {
      for (const [key, value] of Object.entries(stringifyAttributeValues(safeContext))) {
        safely(() => trace.putAttribute(key, truncateString(value, 100)));
      }
    }

    return {
      putAttribute: (key: string, value: string) =>
        safely(() => trace.putAttribute(key, truncateString(value, 100))),
      stop: () => safelyAsync(() => trace.stop()),
    };
  } catch {
    return NOOP_TRACE_HANDLE;
  }
}

/**
 * Convenience wrapper: run `fn` inside a sampled perf trace. The trace
 * instrumentation NEVER throws or swallows `fn`'s own result/error — only
 * the measurement layer is defensive; the wrapped operation behaves exactly
 * as if it were not measured.
 */
export async function reportPerf<T>(
  name: string,
  fn: () => Promise<T> | T,
  context?: Record<string, unknown>,
): Promise<T> {
  const trace = await startPerfTrace(name, context);
  try {
    return await fn();
  } finally {
    await trace.stop();
  }
}
