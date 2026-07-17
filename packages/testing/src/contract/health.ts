
/**
 * Contract helpers for deployable health endpoints used by API smoke tests.
 */

export type HealthContract = {
  readonly service: string;
  readonly status: 'ok' | 'degraded' | 'error';
};

export function assertHealthContract(value: unknown, expectedService: string): HealthContract {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('health payload must be an object');
  }
  const record = value as Record<string, unknown>;
  if (record.service !== expectedService) {
    throw new Error(`expected service ${expectedService}, got ${String(record.service)}`);
  }
  if (record.status !== 'ok' && record.status !== 'degraded' && record.status !== 'error') {
    throw new Error(`unexpected health status: ${String(record.status)}`);
  }
  return { service: record.service, status: record.status };
}
