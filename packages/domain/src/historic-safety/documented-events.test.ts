/**
 * Tests for Layer 1 \u2014 documented historic events (proximity/density, time-banded by era,
 * never decayed to zero).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeDocumentedEventsLayerSignal,
  eraBandsForEvents,
  type DocumentedEventRecord,
} from './documented-events.js';

const CITATION = { claimId: 'claim_1', sourceLabel: 'EJI Lynching in America', retrievedAt: '2026-01-01T00:00:00.000Z' };

test('computeDocumentedEventsLayerSignal returns undefined with no documented events', () => {
  assert.equal(
    computeDocumentedEventsLayerSignal({ placeEntityId: 'place_1', events: [], asOf: '2026-01-01T00:00:00.000Z' }),
    undefined,
  );
});

test('a 1920s lynching contributes exactly as much as a 2020s-recorded one \u2014 never decayed to zero', () => {
  const oldEvent: DocumentedEventRecord = {
    id: 'evt_old',
    placeEntityId: 'place_1',
    category: 'lynching',
    eraSpan: { validFrom: '1922', datePrecision: 'year' },
    proximityWeight: 0.8,
    citation: CITATION,
  };
  const recentlyDocumentedEvent: DocumentedEventRecord = {
    ...oldEvent,
    id: 'evt_recent',
    eraSpan: { validFrom: '1922', datePrecision: 'circa' },
  };
  const oldSignal = computeDocumentedEventsLayerSignal({
    placeEntityId: 'place_1',
    events: [oldEvent],
    asOf: '2026-01-01T00:00:00.000Z',
  });
  const recentSignal = computeDocumentedEventsLayerSignal({
    placeEntityId: 'place_1',
    events: [recentlyDocumentedEvent],
    asOf: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(oldSignal?.value, recentSignal?.value);
  assert.ok((oldSignal?.value ?? 0) > 0);
});

test('density aggregation saturates toward 1 but never exceeds it', () => {
  const events: DocumentedEventRecord[] = Array.from({ length: 5 }, (_, i) => ({
    id: `evt_${i}`,
    placeEntityId: 'place_1',
    category: 'massacre_or_riot',
    eraSpan: { validFrom: '1919', datePrecision: 'year' },
    proximityWeight: 0.9,
    citation: CITATION,
  }));
  const signal = computeDocumentedEventsLayerSignal({ placeEntityId: 'place_1', events, asOf: '2026-01-01T00:00:00.000Z' });
  assert.ok((signal?.value ?? 0) <= 1);
  assert.ok((signal?.value ?? 0) > 0.9);
});

test('documented_displacement is weighted lower than lynching/massacre_or_riot', () => {
  const displacement = computeDocumentedEventsLayerSignal({
    placeEntityId: 'place_1',
    events: [
      {
        id: 'evt_displacement',
        placeEntityId: 'place_1',
        category: 'documented_displacement',
        eraSpan: { validFrom: '1960', datePrecision: 'year' },
        proximityWeight: 1,
        citation: CITATION,
      },
    ],
    asOf: '2026-01-01T00:00:00.000Z',
  });
  const lynching = computeDocumentedEventsLayerSignal({
    placeEntityId: 'place_1',
    events: [
      {
        id: 'evt_lynching',
        placeEntityId: 'place_1',
        category: 'lynching',
        eraSpan: { validFrom: '1960', datePrecision: 'year' },
        proximityWeight: 1,
        citation: CITATION,
      },
    ],
    asOf: '2026-01-01T00:00:00.000Z',
  });
  assert.ok((displacement?.value ?? 0) < (lynching?.value ?? 0));
});

test('every signal carries its own methodology note and >=1 citation', () => {
  const signal = computeDocumentedEventsLayerSignal({
    placeEntityId: 'place_1',
    events: [
      {
        id: 'evt_1',
        placeEntityId: 'place_1',
        category: 'lynching',
        eraSpan: { validFrom: '1930', datePrecision: 'year' },
        proximityWeight: 0.5,
        citation: CITATION,
      },
    ],
    asOf: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(signal?.layerId, 'documented_events');
  assert.ok((signal?.methodologyNote.summary.length ?? 0) > 0);
  assert.equal(signal?.citations.length, 1);
});

test('eraBandsForEvents groups by decade for presentation, not scoring', () => {
  const bands = eraBandsForEvents([
    {
      id: 'evt_1',
      placeEntityId: 'place_1',
      category: 'lynching',
      eraSpan: { validFrom: '1922', datePrecision: 'year' },
      proximityWeight: 0.5,
      citation: CITATION,
    },
    {
      id: 'evt_2',
      placeEntityId: 'place_1',
      category: 'massacre_or_riot',
      eraSpan: { validFrom: '1955', datePrecision: 'year' },
      proximityWeight: 0.5,
      citation: CITATION,
    },
  ]);
  assert.deepEqual([...bands.keys()].sort(), ['1920s', '1950s']);
});

test('rejects an event whose placeEntityId does not match the request', () => {
  assert.throws(
    () =>
      computeDocumentedEventsLayerSignal({
        placeEntityId: 'place_1',
        events: [
          {
            id: 'evt_1',
            placeEntityId: 'place_OTHER',
            category: 'lynching',
            eraSpan: { validFrom: '1930', datePrecision: 'year' },
            proximityWeight: 0.5,
            citation: CITATION,
          },
        ],
        asOf: '2026-01-01T00:00:00.000Z',
      }),
    /placeEntityId/,
  );
});
