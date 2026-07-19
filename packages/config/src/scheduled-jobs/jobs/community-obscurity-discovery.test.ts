/**
 * Proves the community-obscurity scheduled job ranks ABS-shaped fixture leads without publishing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runCommunityObscurityDiscoveryJob } from './community-obscurity-discovery.ts';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'domain',
  'src',
  'adapters',
  'rss',
  'fixtures',
  'the-american-blackstory.trimmed.rss.xml',
);

test('community obscurity job completes with ranked private leads and disclaimer', () => {
  const xml = readFileSync(FIXTURE, 'utf8');
  const result = runCommunityObscurityDiscoveryJob({
    jobRunId: 'community-obscurity-run-1',
    startedAt: '2026-07-19T10:00:00.000Z',
    completedAt: '2026-07-19T10:05:00.000Z',
    feedXmlByFeedId: new Map([['feed_the_american_blackstory', xml]]),
    catalogTitles: [
      'Rosa Parks',
      'Martin Luther King Jr.',
      'Buffalo Soldiers',
      'Harriet Tubman',
      'Frederick Douglass',
    ],
  });
  assert.equal(result.run.status, 'success');
  assert.equal(result.run.jobId, 'community-obscurity-discovery');
  assert.ok(result.campaign.ranked.length >= 3);
  assert.ok(result.campaign.disclaimer.body.includes('relative'));
  assert.ok(result.campaign.authorityFollowUps.length >= 1);
  const top = result.campaign.ranked[0];
  assert.ok(top);
  assert.ok(
    top.title?.includes('Stormé') || top.title?.includes('Rosewood'),
    `unexpected top: ${top.title}`,
  );
});
