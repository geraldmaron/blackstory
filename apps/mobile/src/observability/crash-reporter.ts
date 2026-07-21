/**
 * Crash / performance reporting — dev-console sink (MOB-018; privacy invariant 7).
 *
 * `reportError`, `addBreadcrumb`, `startPerfTrace`, and `reportPerf` are the
 * complete public surface. Every context object passed in here is redacted
 * through `src/security/log-redaction.ts` before it can be emitted, then
 * size-capped so an unbounded payload never ships. In `__DEV__` only, redacted
 * output goes to the console — no third-party crash SDK is linked.
 *
 * Every call is wrapped in its own try/catch, and the whole exported function
 * is wrapped again, so a bug in THIS reporter's own code can never propagate
 * and crash the caller.
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

/** Test-only seam: clear module state between tests. */
export function __resetObservabilityForTests(): void {
  activeReportContext = UNSET_REPORT_CONTEXT;
  activeConfig = {
    observabilityEnabled: DEFAULT_OBSERVABILITY_ENABLED,
    performanceSampleRate: DEFAULT_PERFORMANCE_SAMPLE_RATE,
  };
}

function devLoggingEnabled(): boolean {
  return (
    activeConfig.observabilityEnabled &&
    typeof __DEV__ !== 'undefined' &&
    __DEV__
  );
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
    // Never let a logging call's failure escape this module.
  }
}

async function safelyAsync(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Same contract as `safely`, for promise-returning work.
  }
}

export interface ReportErrorOptions {
  readonly context?: Record<string, unknown>;
  /** Marks the report as a fatal (app-crashing) event vs. a handled/caught one. */
  readonly fatal?: boolean;
}

/**
 * Report an error/exception. This function NEVER throws — every failure mode
 * degrades to a no-op. In `__DEV__`, emits a redacted console.error line.
 */
export function reportError(
  error: unknown,
  options: ReportErrorOptions = {},
): void {
  try {
    if (!devLoggingEnabled()) {
      return;
    }

    const normalizedError = normalizeToError(error);
    const mergedContext = redactAndCapContext({
      ...reportContextToAttributes(activeReportContext),
      fatal: String(options.fatal ?? false),
      ...options.context,
    });

    safely(() => {
      console.error('[BlackStory:reportError]', normalizedError.message, mergedContext);
    });
  } catch {
    // Defensive outer guard.
  }
}

/**
 * Attach a lightweight breadcrumb (not a full error) to the dev timeline.
 * Same redaction + size-cap + never-throw contract as `reportError`.
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  try {
    if (!devLoggingEnabled()) {
      return;
    }

    const safeMessage = truncateString(
      redactSingleString(message),
      MAX_BREADCRUMB_MESSAGE_LENGTH,
    );
    const safeData = redactAndCapContext(data);
    const line = safeData ? `${safeMessage} ${JSON.stringify(safeData)}` : safeMessage;

    safely(() => {
      console.debug('[BlackStory:breadcrumb]', truncateString(line, MAX_BREADCRUMB_MESSAGE_LENGTH));
    });
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

export interface PerfTraceHandle {
  putAttribute(key: string, value: string): void;
  stop(): Promise<void>;
}

const NOOP_TRACE_HANDLE: PerfTraceHandle = {
  putAttribute: () => {},
  stop: async () => {},
};

function sanitizeTraceName(name: string): string {
  return truncateString(redactSingleString(name), 100).replace(/[^\w.\-/ ]/g, '_');
}

/**
 * Start a sampled performance trace. Sampling applies BEFORE any work — an
 * unsampled trace is a true no-op. In `__DEV__`, sampled traces log start/stop
 * to the console with redacted attributes.
 */
export async function startPerfTrace(
  name: string,
  context?: Record<string, unknown>,
): Promise<PerfTraceHandle> {
  try {
    if (!devLoggingEnabled()) {
      return NOOP_TRACE_HANDLE;
    }
    if (!shouldSamplePerfTrace(activeConfig.performanceSampleRate)) {
      return NOOP_TRACE_HANDLE;
    }

    const traceName = sanitizeTraceName(name);
    const safeContext = redactAndCapContext({
      ...reportContextToAttributes(activeReportContext),
      ...context,
    });
    const startedAt = Date.now();

    safely(() => {
      console.debug('[BlackStory:perf:start]', traceName, safeContext);
    });

    return {
      putAttribute: (key: string, value: string) => {
        safely(() => {
          console.debug('[BlackStory:perf:attr]', traceName, key, truncateString(value, 100));
        });
      },
      stop: () =>
        safelyAsync(async () => {
          const durationMs = Date.now() - startedAt;
          console.debug('[BlackStory:perf:stop]', traceName, { durationMs, ...(safeContext ?? {}) });
        }),
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
