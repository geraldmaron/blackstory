/**
 * Verifies structured logger filtering and operational error serialization.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError, createLogger } from './index.ts';

test('createLogger emits deterministic structured JSON', () => {
  const lines: string[] = [];
  const logger = createLogger({
    service: 'unit-test',
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
    sink: (line) => lines.push(line),
  });

  logger.info('ready', { requestId: 'request-1' });

  assert.deepEqual(JSON.parse(lines[0] ?? ''), {
    timestamp: '2026-01-01T00:00:00.000Z',
    level: 'info',
    service: 'unit-test',
    message: 'ready',
    requestId: 'request-1',
  });
});

test('createLogger filters records below its configured level', () => {
  const lines: string[] = [];
  const logger = createLogger({
    service: 'unit-test',
    level: 'warn',
    sink: (line) => lines.push(line),
  });

  logger.info('filtered');
  logger.warn('kept');

  assert.equal(lines.length, 1);
});

test('createLogger serializes AppError without exposing its cause', () => {
  const lines: string[] = [];
  const logger = createLogger({ service: 'unit-test', sink: (line) => lines.push(line) });
  const error = new AppError('Invalid request', {
    code: 'INVALID_REQUEST',
    status: 400,
    cause: new Error('sensitive detail'),
  });

  logger.error('request failed', error);

  assert.deepEqual(JSON.parse(lines[0] ?? '').error, {
    name: 'AppError',
    message: 'Invalid request',
    code: 'INVALID_REQUEST',
    status: 400,
  });
});
