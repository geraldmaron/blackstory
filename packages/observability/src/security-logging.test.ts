/**
 * Proves the observability logger, wired with the central redactor, keeps residential
 * addresses and exact coordinates out of log output and error telemetry.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSensitiveDataRedactor } from '@repo/security';
import { AppError, createLogger, type LogContext } from './index.ts';

function wiredLogger(lines: string[]) {
  const redactor = createSensitiveDataRedactor();
  return createLogger({
    service: 'ds-015-test',
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
    sink: (line) => lines.push(line),
    redact: (record: LogContext) => redactor(record) as LogContext,
  });
}

test('logger redacts residential address fields and coordinates', () => {
  const lines: string[] = [];
  wiredLogger(lines).info('geocoded subject', {
    entityId: 'ent_1',
    streetAddress: '742 Evergreen Terrace',
    lat: 38.90721,
    lng: -77.03691,
  });

  const record = JSON.parse(lines[0] ?? '') as Record<string, unknown>;
  assert.equal(record.entityId, 'ent_1');
  assert.equal(record.streetAddress, '[REDACTED]');
  assert.equal(record.lat, '[REDACTED]');
  assert.equal(record.lng, '[REDACTED]');
});

test('logger redacts address-shaped text embedded in error telemetry', () => {
  const lines: string[] = [];
  const error = new AppError('lookup failed for 1600 Pennsylvania Ave', {
    code: 'GEOCODE_FAILED',
    status: 502,
  });
  wiredLogger(lines).error('geocode error', error, { note: 'retry near 20 W 34th St' });

  const record = JSON.parse(lines[0] ?? '') as Record<string, unknown>;
  assert.match(String(record.note), /\[REDACTED\]/);
  const serialized = record.error as Record<string, unknown>;
  assert.match(String(serialized.message), /\[REDACTED\]/);
  assert.equal(serialized.code, 'GEOCODE_FAILED');
});
