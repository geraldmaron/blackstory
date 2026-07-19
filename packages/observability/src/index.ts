/**
 * Structured logging, operational errors, and security telemetry shared across services.
 */
export const OBSERVABILITY_PACKAGE = '@repo/observability' as const;

export {
  SECURITY_TELEMETRY_VERSION,
  securityEventKinds,
  securityEventSeverities,
  AUDIT_ACTION_TO_SECURITY_KIND,
  IMMEDIATE_NOTIFICATION_KINDS,
  defaultSeverityForKind,
  defaultRunbookForKind,
  createSecurityEventId,
} from './security-events.js';
export type {
  SecurityEventKind,
  SecurityEventSeverity,
  SecurityEventContext,
  SecurityEventDimensions,
  SecurityTelemetryEvent,
} from './security-events.js';

export {
  SECURITY_SENSITIVE_KEYS,
  redactSecurityMetadata,
  redactSecurityEvent,
  fingerprintDimension,
} from './security-redaction.js';

export {
  SECURITY_METRICS_NAMESPACE,
  SECURITY_METRIC_DESCRIPTORS,
  EVENT_KIND_TO_METRICS,
  buildMetricSample,
  metricDescriptor,
  fullyQualifiedMetricName,
} from './security-metrics.js';
export type {
  SecurityMetricType,
  SecurityMetricDescriptor,
  SecurityMetricSample,
} from './security-metrics.js';

export {
  SECURITY_ANOMALY_POLICY_VERSION,
  DEFAULT_ANOMALY_RULES,
  evaluateAnomalyRules,
  triggeredAnomalies,
  immediateNotificationAnomalies,
} from './security-anomaly.js';
export type { AnomalyComparator, AnomalyRule, AnomalyEvaluation } from './security-anomaly.js';

export {
  SECURITY_ALERT_POLICY_VERSION,
  DEFAULT_ALERT_POLICIES,
  buildAlertPayload,
  alertPolicyById,
  policiesRequiringImmediateNotification,
} from './security-alerts.js';
export type {
  AlertNotificationChannel,
  SecurityAlertPolicy,
  SecurityAlertPayload,
} from './security-alerts.js';

export {
  adaptAppCheckTelemetry,
  adaptAuditEvent,
  adaptRateLimitDenial,
  adaptSlowQuery,
  adaptQueueSignal,
  adaptArmorSignal,
  adaptStorageDenial,
  adaptServiceHealth,
  adaptCostAnomaly,
  adaptSourceAdapterAnomaly,
  adaptUnexpectedPublicWrite,
  adaptDatabaseConnections,
} from './security-adapters.js';
export type {
  AppCheckTelemetryInput,
  RateLimitDenialInput,
  SlowQueryInput,
  QueueSignalInput,
  ArmorSignalInput,
  StorageDenialInput,
  ServiceHealthInput,
  CostAnomalyInput,
} from './security-adapters.js';

export { createSecurityTelemetryRecorder } from './security-telemetry.js';
export type {
  SecurityTelemetrySink,
  SecurityTelemetryRecorderOptions,
  SecurityTelemetryRecordResult,
} from './security-telemetry.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Readonly<Record<string, unknown>>;
export type LogSink = (line: string) => void;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

/**
 * Redacts a structured log record before it is written. Wire the central redactor
 * from @repo/security here so protected values (residential addresses, exact
 * coordinates) never reach log output or error telemetry.
 */
export type LogRedactor = (record: LogContext) => LogContext;

export interface LoggerOptions {
  readonly service: string;
  readonly level?: LogLevel;
  readonly clock?: () => Date;
  readonly sink?: LogSink;
  readonly redact?: LogRedactor;
}

export interface AppErrorOptions {
  readonly code: string;
  readonly status?: number;
  readonly cause?: unknown;
}

export class AppError extends Error {
  public override readonly name = 'AppError';
  public readonly code: string;
  public readonly status: number;

  public constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.code = options.code;
    this.status = options.status ?? 500;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function serializeError(error: unknown): LogContext {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return { value: String(error) };
}

export function createLogger(options: LoggerOptions): Logger {
  const threshold = LEVEL_PRIORITY[options.level ?? 'info'];
  const clock = options.clock ?? (() => new Date());
  const sink = options.sink ?? ((line: string) => console.log(line));
  const redact = options.redact ?? ((record: LogContext) => record);

  function write(level: LogLevel, message: string, context: LogContext = {}): void {
    if (LEVEL_PRIORITY[level] < threshold) {
      return;
    }
    const redactedContext = redact(context);
    sink(
      JSON.stringify({
        timestamp: clock().toISOString(),
        level,
        service: options.service,
        message,
        ...redactedContext,
      }),
    );
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, error, context) =>
      write('error', message, {
        ...context,
        ...(error === undefined ? {} : { error: serializeError(error) }),
      }),
  };
}
