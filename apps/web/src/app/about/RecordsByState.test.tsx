import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecordsByState, shadeStep } from './RecordsByState';

void React;

test('shade steps run 0 for none, then 1 to 5 on a log scale up to the largest count', () => {
  assert.equal(shadeStep(0, 900), 0);
  assert.equal(shadeStep(1, 900), 1);
  assert.equal(shadeStep(30, 900), 3);
  assert.equal(shadeStep(900, 900), 5);
  assert.equal(shadeStep(1, 1), 5);
});

test('every state is drawn, counts come through, and undrawn records are said out loud', () => {
  const html = renderToStaticMarkup(
    <RecordsByState
      states={[
        { postal: 'VA', name: 'Virginia', count: 400 },
        { postal: 'GA', name: 'Georgia', count: 120 },
        { postal: 'DC', name: 'District of Columbia', count: 80 },
        { postal: 'NC', name: 'North Carolina', count: 300 },
      ]}
      totalRecords={1000}
    />,
  );
  assert.equal(html.match(/ds-about-states__tile/g)?.length, 51);
  assert.match(html, /most records sit in Virginia, North Carolina and Georgia/);
  assert.match(html, /Virginia, 400 records/);
  assert.match(html, /in 3 states and DC/);
  assert.match(html, /100 are not tied to one state/);
});
