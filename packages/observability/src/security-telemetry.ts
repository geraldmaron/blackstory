/**
 * Security telemetry recorder redacts, emits metrics, evaluates anomalies, and
 * builds alert payloads from normalized security events.
 */
import {
  buildAlertPayload,
  DEFAULT_ALERT_POLICIES,
  type SecurityAlertPayload,
} from './security-alerts.js';
import {
  evaluateAnomalyRules,
  immediateNotificationAnomalies,
  triggeredAnomalies,
  type AnomalyEvaluation,
  type AnomalyRule,
} from './security-anomaly.js';
import { buildMetricSample, type SecurityMetricSample } from './security-metrics.js';
import { redactSecurityEvent } from './security-redaction.js';
import type { SecurityTelemetryEvent } from './security-events.js';
import type { LogContext, Logger } from './index.js';

export type SecurityTelemetrySink = {
  readonly recordEvent?: (event: SecurityTelemetryEvent) => void;
  readonly recordMetric?: (sample: SecurityMetricSample) => void;
  readonly recordAlert?: (alert: SecurityAlertPayload) => void;
};

export type SecurityTelemetryRecorderOptions = {
  readonly service: string;
  readonly releaseId?: string | undefined;
  readonly logger?: Logger | undefined;
  readonly sink?: SecurityTelemetrySink | undefined;
  readonly anomalyRules?: readonly AnomalyRule[] | undefined;
  readonly clock?: () => Date;
};

export type SecurityTelemetryRecordResult = {
  readonly event: SecurityTelemetryEvent;
  readonly metrics: readonly SecurityMetricSample[];
  readonly evaluations: readonly AnomalyEvaluation[];
  readonly alerts: readonly SecurityAlertPayload[];
};

function metricValueForEvent(event: SecurityTelemetryEvent): number {
  switch (event.kind) {
    case 'queue.depth':
      return Number(event.dimensions.depth ?? 1);
    case 'service.latency':
      return Number(event.dimensions.latencyMs ?? 0);
    case 'cost.anomaly':
      return Number(event.dimensions.score ?? 0);
    case 'database.connection':
      return Number(event.dimensions.activeConnections ?? 1);
    default:
      return 1;
  }
}

export function createSecurityTelemetryRecorder(options: SecurityTelemetryRecorderOptions): {
  record(event: SecurityTelemetryEvent): SecurityTelemetryRecordResult;
  evaluateSamples(samples: readonly SecurityMetricSample[]): readonly AnomalyEvaluation[];
} {
  const clock = options.clock ?? (() => new Date());
  const samples: SecurityMetricSample[] = [];

  function record(event: SecurityTelemetryEvent): SecurityTelemetryRecordResult {
    const redacted = redactSecurityEvent({
      ...event,
      occurredAt: clock().toISOString(),
      context: {
        ...event.context,
        service: event.context.service || options.service,
        ...(options.releaseId === undefined ? {} : { releaseId: options.releaseId }),
      },
    });

    const metricValue = metricValueForEvent(redacted);
    const eventMetrics = buildMetricSample({
      kind: redacted.kind,
      value: metricValue,
      occurredAt: redacted.occurredAt,
      service: redacted.context.service,
      dimensions: redacted.dimensions,
    });

    for (const metric of eventMetrics) {
      samples.push(metric);
      options.sink?.recordMetric?.(metric);
    }

    options.sink?.recordEvent?.(redacted);
    options.logger?.info('security.telemetry', redacted as unknown as LogContext);

    const evaluations = evaluateAnomalyRules({
      ...(options.anomalyRules === undefined ? {} : { rules: options.anomalyRules }),
      samples,
      nowMs: clock().getTime(),
    });
    const triggered = triggeredAnomalies(evaluations);
    const alerts = triggered.map((evaluation) => {
      const policy = DEFAULT_ALERT_POLICIES.find((entry) => entry.id === evaluation.ruleId);
      if (policy === undefined) {
        throw new Error(`Missing alert policy for rule ${evaluation.ruleId}`);
      }
      const alert = buildAlertPayload({
        policy,
        service: redacted.context.service,
        correlationId: redacted.context.correlationId,
        observedValue: evaluation.observedValue,
        triggeredAt: clock().toISOString(),
        ...(redacted.context.releaseId === undefined
          ? options.releaseId === undefined
            ? {}
            : { releaseId: options.releaseId }
          : { releaseId: redacted.context.releaseId }),
        ...(redacted.context.requestId === undefined
          ? {}
          : { requestId: redacted.context.requestId }),
      });
      options.sink?.recordAlert?.(alert);
      if (evaluation.immediateNotification) {
        options.logger?.warn('security.alert.immediate', alert as unknown as LogContext);
      }
      return alert;
    });

    return {
      event: redacted,
      metrics: eventMetrics,
      evaluations,
      alerts,
    };
  }

  function evaluateSamples(
    metricSamples: readonly SecurityMetricSample[],
  ): readonly AnomalyEvaluation[] {
    return evaluateAnomalyRules({
      ...(options.anomalyRules === undefined ? {} : { rules: options.anomalyRules }),
      samples: metricSamples,
      nowMs: clock().getTime(),
    });
  }

  return { record, evaluateSamples };
}

export { immediateNotificationAnomalies, triggeredAnomalies };
