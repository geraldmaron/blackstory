import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LivesSourceNotice } from './LivesSourceNotice';

void React;

const render = (source: 'snapshot' | 'unpublished' | 'unreadable') =>
  renderToStaticMarkup(
    <LivesSourceNotice source={source} areaName="United States" retryHref="/lives" />,
  );

test('a counted snapshot renders no notice', () => {
  assert.equal(render('snapshot'), '');
});

test('an unpublished area says so without offering a retry or implying zero', () => {
  const html = render('unpublished');
  assert.match(html, /No counts published for this area yet/);
  assert.match(html, /not yet counted/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /Try again/);
});

test('an unreadable snapshot is an alert with a native retry link and no zero claim', () => {
  const html = render('unreadable');
  assert.match(html, /role="alert"/);
  assert.match(html, /These counts could not be read/);
  assert.match(html, /<a class="lives-source-notice__retry" href="\/lives">Try again<\/a>/);
  assert.match(html, /Nothing here is a count of zero/);
  assert.doesNotMatch(html, /—/);
});
