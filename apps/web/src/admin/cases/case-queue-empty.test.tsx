import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaseQueueEmpty } from './case-queue-empty';

void React;

const here = dirname(fileURLToPath(import.meta.url));

test('a narrowed list offers a native link back to the unfiltered desk', () => {
  const html = renderToStaticMarkup(
    <CaseQueueEmpty mode="inbox" filtered clearHref="/admin/inbox" />,
  );
  assert.match(html, /No research cases match/);
  assert.match(html, /<a [^>]*href="\/admin\/inbox"[^>]*>Clear filters<\/a>/);
  assert.match(html, /role="status"/);
});

test('an unfiltered empty inbox and an empty case list say different things and offer no clear link', () => {
  const inbox = renderToStaticMarkup(
    <CaseQueueEmpty mode="inbox" filtered={false} clearHref="/admin/inbox" />,
  );
  const cases = renderToStaticMarkup(
    <CaseQueueEmpty mode="cases" filtered={false} clearHref="/admin/cases" />,
  );
  assert.match(inbox, /The inbox is empty/);
  assert.match(cases, /No research cases yet/);
  assert.doesNotMatch(inbox + cases, /Clear filters/);
});

test('case rows open the detail sheet from a native button and focus returns on close', () => {
  const source = readFileSync(join(here, 'CaseQueue.tsx'), 'utf8');
  assert.match(source, /<button\s+type="button"\s+className="acq__row-open"/);
  assert.match(source, /data-case-open=\{row\.id\}/);
  assert.match(source, /querySelector<HTMLElement>\(`\[data-case-open=/);
});
