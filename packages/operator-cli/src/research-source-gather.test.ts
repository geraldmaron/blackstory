/**
 * Tests for research-source-gather safe-fetch helpers (injected transport).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SafeFetchDependencies } from '@repo/security/url-safety';
import {
  formatGatheredSourceSnippet,
  gatherSourceSnippetsFromUrls,
  wrapPrefetchedSourceSnippet,
} from './research-source-gather.ts';

test('formatGatheredSourceSnippet labels prefetched vs fetched sources', () => {
  const prefetched = wrapPrefetchedSourceSnippet(
    'https://justice.tougaloo.edu/sundowntown/anna-il/',
    'Anna Illinois sundown town page with Sundown Town in the Past? Surely and quoted newspaper references from the 1900s.',
  );
  assert.ok(prefetched);
  const formatted = formatGatheredSourceSnippet(prefetched!);
  assert.match(formatted, /prefetched/iu);
  assert.match(formatted, /Anna Illinois/iu);

  const fetched = { ...prefetched!, fetched: true as const, finalUrl: prefetched!.url };
  assert.match(formatGatheredSourceSnippet(fetched), /^Source \(Tier: T2\): https:\/\//u);
});

test('formatGatheredSourceSnippet tags the source tier from the shared registry', () => {
  const snippet = wrapPrefetchedSourceSnippet('https://census.gov/some-report', 'A'.repeat(150));
  assert.ok(snippet);
  assert.match(formatGatheredSourceSnippet(snippet!), /Tier: T1/u);

  const untrusted = wrapPrefetchedSourceSnippet(
    'https://random-blogspot-example.com/post',
    'B'.repeat(150),
  );
  assert.ok(untrusted);
  assert.match(formatGatheredSourceSnippet(untrusted!), /Tier: T4/u);
});

test('wrapPrefetchedSourceSnippet rejects text shorter than the usable threshold', () => {
  assert.equal(wrapPrefetchedSourceSnippet('https://example.org/x', 'too short'), undefined);
  const wrapped = wrapPrefetchedSourceSnippet('https://example.org/x', 'A'.repeat(120));
  assert.ok(wrapped);
  assert.equal(wrapped!.fetched, false);
});

/**
 * Dedupe, which is not a tidiness concern.
 *
 * Independence is the whole basis of corroboration, so one page counted twice is a duplicate that
 * looks independent — worse than an obvious one. These cover both places it can hide: the same page
 * spelled two ways before the request, and two different URLs redirecting to one document after it.
 */
function pageTransport(
  pages: Readonly<Record<string, { body?: string; redirectTo?: string }>> = {},
): {
  readonly dependencies: SafeFetchDependencies;
  readonly requested: string[];
} {
  const requested: string[] = [];
  const dependencies: SafeFetchDependencies = {
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async (request) => {
      requested.push(request.url);
      const page = pages[request.url] ?? {};
      if (page.redirectTo !== undefined) {
        async function* empty(): AsyncGenerator<Uint8Array> {
          // A 302 body is never read.
        }
        return {
          status: 302,
          headers: { location: page.redirectTo },
          remoteAddress: '93.184.216.34',
          body: empty(),
        };
      }
      const text = page.body ?? 'A'.repeat(200);
      async function* body(): AsyncGenerator<Uint8Array> {
        yield new TextEncoder().encode(text);
      }
      return {
        status: 200,
        headers: { 'content-type': 'text/plain' },
        remoteAddress: '93.184.216.34',
        body: body(),
      };
    },
  };
  return { dependencies, requested };
}

test('gatherSourceSnippetsFromUrls fetches one page once however it is spelled', async () => {
  const { dependencies, requested } = pageTransport({});
  const snippets = await gatherSourceSnippetsFromUrls(
    [
      'https://www.nps.gov/places/item.htm?a=1',
      // Same page: host case, a tracking parameter, reordered params, a fragment, whitespace.
      '  https://WWW.NPS.GOV/places/item.htm?utm_source=x&a=1#history  ',
      'https://www.nps.gov/places/item.htm?a=1',
    ],
    { dependencies },
  );
  assert.equal(requested.length, 1, 'the same page must not be fetched twice');
  assert.equal(snippets.length, 1);
  assert.equal(snippets[0]?.url, 'https://www.nps.gov/places/item.htm?a=1');
});

test('gatherSourceSnippetsFromUrls still fetches URLs that only look similar', async () => {
  const { dependencies, requested } = pageTransport({});
  const snippets = await gatherSourceSnippetsFromUrls(
    [
      'https://nps.gov/a',
      // A www subdomain is a different host, a deeper trailing slash may be a different resource,
      // and path case is not host case. Merging any of these would cost a real source.
      'https://www.nps.gov/a',
      'https://nps.gov/a/',
      'https://nps.gov/A',
    ],
    { dependencies },
  );
  assert.equal(requested.length, 4);
  assert.equal(snippets.length, 4);
});

test('gatherSourceSnippetsFromUrls collapses two URLs that redirect to one document', async () => {
  // No canonicalization before the request can know these are the same page; only the response can.
  const { dependencies, requested } = pageTransport({
    'https://nps.gov/old-path': { redirectTo: 'https://nps.gov/canonical' },
    'https://nps.gov/other-path': { redirectTo: 'https://nps.gov/canonical' },
    'https://nps.gov/canonical': { body: 'B'.repeat(200) },
  });
  const snippets = await gatherSourceSnippetsFromUrls(
    ['https://nps.gov/old-path', 'https://nps.gov/other-path'],
    { dependencies },
  );
  // Both redirects are followed, because the duplicate is only knowable afterwards.
  assert.ok(requested.includes('https://nps.gov/old-path'));
  assert.ok(requested.includes('https://nps.gov/other-path'));
  // One document is one source.
  assert.equal(snippets.length, 1);
  assert.equal(snippets[0]?.finalUrl, 'https://nps.gov/canonical');
});

test('gatherSourceSnippetsFromUrls drops blanks and non-http URLs without fetching them', async () => {
  const { dependencies, requested } = pageTransport({});
  const snippets = await gatherSourceSnippetsFromUrls(['', '   ', 'https://nps.gov/real'], {
    dependencies,
  });
  assert.equal(requested.length, 1);
  assert.equal(snippets.length, 1);
});
