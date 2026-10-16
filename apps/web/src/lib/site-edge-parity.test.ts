/**
 * Drift guard while both stacks exist. apps/site/server/edge/*.cjs is a port of this app's
 * proxy.ts pipeline; until the Next app is removed, every decision the port makes must equal the
 * original's. Delete this file with apps/web.
 *
 * Intentional differences, each asserted below rather than hidden: the static build output the
 * wall and the staff gate exempt is `/_expo/static` (site) where it was `/_next/static` and
 * `/_next/image` (web); and the staff gate matches case-insensitively on a normalized path (the
 * site decodes percent-encoding and Expo loader routes first; see apps/site/server/edge/paths.cjs).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import * as agentLists from './traffic-class/agent-lists';
import { classifyTraffic } from './traffic-class/classify';
import { shouldDenyAiCrawler, isExpensiveOriginPath } from './traffic-class/edge-deny';
import {
  decideMaintenance,
  readMaintenanceSettings,
  isMaintenanceExemptPath,
} from './maintenance/maintenance-policy';
import { renderMaintenancePage } from './maintenance/maintenance-page';
import { buildContentSecurityPolicy } from './web-security/csp';
import { buildGlobalSecurityHeaders } from './web-security/security-headers';
import { surfaceClassFor, CLASSIFIED_PATHS, ENDPOINT_ROUTES } from './nav/surface-classes';
import {
  buildNormalizedUrl,
  canonicalPathAndSearch,
  needsQueryNormalizationRedirect,
  normalizeQueryString,
} from './runtime-hardening/query-normalization';
import { handleQueryNormalization } from './runtime-hardening/edge-query-normalization';
import {
  CORRECTIONS_PAGE_PARAM_ALLOWLIST,
  LAW_PAGE_PARAM_ALLOWLIST,
  PLACE_PAGE_PARAM_ALLOWLIST,
  SEARCH_PAGE_PARAM_ALLOWLIST,
  STORIES_PAGE_PARAM_ALLOWLIST,
  TRACKING_QUERY_KEYS,
  TRACKING_QUERY_PREFIXES,
  isPlatformPassthroughQueryKey,
} from './runtime-hardening/constants';
import {
  RECORDS_PAGE_PARAM_ALLOWLIST,
  isRecordsCombinationQuery,
  parseRecordsQuery,
  recordsHref,
  recordsQueryString,
} from './records/records-query';
import { TOPIC_REGISTRY } from '@repo/domain/taxonomy/topics';
import { isAuthGatedPath } from '../admin/auth/protected-paths';
import {
  isRequestWithinLimit,
  requestSizeKindForContentType,
} from './web-security/request-size-limits';
import { readSupabaseRoleFromAppMetadata } from '../admin/auth/supabase-session-authorizer';
import {
  isPublicDocumentCacheable,
  isSecurityNormalizedPath,
  PUBLIC_DOCUMENT_CDN_CACHE_CONTROL,
} from '../proxy';

const require = createRequire(import.meta.url);
const site = (name: string) => require(`../../../site/server/edge/${name}.cjs`);
const lists = require('../../../site/server/edge/agent-lists.json') as Record<string, string[]>;
const traffic = site('traffic');
const maintenance = site('maintenance');
const securityHeaders = site('security-headers');
const surfaces = site('surfaces');
const staffGate = site('staff-gate');
const limits = site('request-limits');
const queryNorm = site('query-normalization');
const recordsQuery = site('records-query');
const topicIds = require('../../../site/server/edge/topic-ids.json') as string[];

const USER_AGENTS = [
  '',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)',
  'ClaudeBot/1.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0)',
  'Mozilla/5.0 (compatible; SemrushBot/7)',
  'curl/8.4.0',
  'python-requests/2.31',
  'Mozilla/5.0 HeadlessChrome/120.0',
  'facebookexternalhit/1.1',
  'Bytespider',
  'Mozilla/5.0 (X11; Linux x86_64) Playwright',
];
const PATHS = [
  '/',
  '/explore',
  '/records',
  '/records/',
  '/methodology',
  '/atlas/catalog',
  '/sitemap.xml',
  '/explore/api',
  '/search/api/q',
  '/locate/api',
  '/place/x',
  '/stories/y',
  '/exploration',
  '/admin',
  '/admin/cases',
  '/admin/login',
  '/admin/api/work',
  '/design-system',
  '/design-system/tokens',
  '/design-system/logo.svg',
  '/admin/report.png',
  '/robots.txt',
  '/favicon.ico',
  '/brand/lockup-dark.png',
  '/logo.svg',
  '/corrections/status/abc',
  '/search',
  '/law/browse',
  '/law/case',
  '/some-new-page',
];

test('agent lists are identical to agent-lists.ts', () => {
  for (const name of [
    'AI_TRAINING_USER_AGENTS',
    'SEO_TOOL_USER_AGENTS',
    'SEARCH_CRAWLER_USER_AGENTS',
    'TOOL_USER_AGENTS',
    'AUTOMATED_USER_AGENTS',
  ] as const) {
    assert.deepEqual(lists[name], [...agentLists[name]], name);
  }
});

test('traffic classification and the crawler deny agree on every user agent and path', () => {
  for (const userAgent of USER_AGENTS) {
    for (const signals of [
      { userAgent },
      { userAgent, acceptLanguage: '' },
      { userAgent, languages: [] as string[] },
      { userAgent, webdriver: true },
    ]) {
      assert.equal(
        traffic.classifyTraffic(signals),
        classifyTraffic(signals),
        JSON.stringify(signals),
      );
    }
    for (const path of PATHS) {
      assert.equal(
        traffic.shouldDenyAiCrawler(path, userAgent),
        shouldDenyAiCrawler(path, userAgent),
        `${path} ${userAgent}`,
      );
    }
  }
  for (const path of PATHS) {
    assert.equal(traffic.isExpensiveOriginPath(path), isExpensiveOriginPath(path), path);
  }
});

test('maintenance settings, decisions and the page agree', () => {
  const envs: Array<Record<string, string | undefined>> = [
    {},
    { MAINTENANCE_MODE: '1', MAINTENANCE_BYPASS_TOKEN: 'sekret' },
    {
      MAINTENANCE_MODE: ' TRUE ',
      MAINTENANCE_RETRY_AFTER_SECONDS: '120',
      MAINTENANCE_MESSAGE: ' down ',
    },
    { MAINTENANCE_MODE: 'on', MAINTENANCE_RETRY_AFTER_SECONDS: '99999999' },
    {
      MAINTENANCE_MODE: 'enabled',
      MAINTENANCE_RETRY_AFTER_SECONDS: 'abc',
      MAINTENANCE_BYPASS_TOKEN: ' x ',
    },
    { MAINTENANCE_MODE: 'yes' },
  ];
  for (const env of envs) {
    assert.deepEqual(
      maintenance.readMaintenanceSettings(env),
      readMaintenanceSettings(env),
      JSON.stringify(env),
    );
  }

  const settingsList = envs.map((env) => readMaintenanceSettings(env));
  const candidates = ['sekret', 'x', 'nope', '', null];
  for (const settings of settingsList) {
    for (const path of PATHS) {
      for (const candidate of candidates) {
        const facts = {
          pathname: path,
          bypassParam: candidate,
          bypassCookie: candidate,
          bypassHeader: null,
        };
        assert.deepEqual(
          maintenance.decideMaintenance(settings, facts),
          decideMaintenance(settings, facts),
          `${path} ${JSON.stringify(settings)} ${candidate}`,
        );
      }
    }
  }

  // The one intended difference: Next's static output is exempt there, Expo's here.
  assert.equal(isMaintenanceExemptPath('/_next/static/a.js'), true);
  assert.equal(isMaintenanceExemptPath('/_next/image?url=a'), true);
  assert.equal(maintenance.isMaintenanceExemptPath('/_expo/static/js/web/a.js'), true);
  assert.equal(maintenance.isMaintenanceExemptPath('/_next/static/a.js'), false);

  for (const options of [
    { retryAfterSeconds: 60 },
    { retryAfterSeconds: 7200, message: 'Back at <noon> & "soon"' },
    { retryAfterSeconds: 400000 },
  ]) {
    assert.equal(maintenance.renderMaintenancePage(options), renderMaintenancePage(options));
  }
});

test('CSP and the global header set agree for every option combination', () => {
  const nonces = [undefined, 'abc123==', 'N+/=='];
  const authUrls = [
    undefined,
    'https://abc.supabase.co',
    'https://abc.supabase.co/auth/v1',
    'http://localhost:54321',
    'https://user:pw@abc.supabase.co',
    'https://*.supabase.co',
    'https://abc.supabase.co/?x=1',
    'not a url',
  ];
  for (const nonce of nonces) {
    for (const isDev of [true, false]) {
      for (const authUrl of authUrls) {
        const options = { ...(nonce ? { nonce } : {}), ...(authUrl ? { authUrl } : {}), isDev };
        assert.equal(
          securityHeaders.buildContentSecurityPolicy(options),
          buildContentSecurityPolicy(options),
          JSON.stringify(options),
        );
      }
    }
  }
  assert.equal(securityHeaders.THEME_BOOTSTRAP_SCRIPT_SHA256.length > 20, true);
  for (const nonce of nonces) {
    for (const authUrl of authUrls) {
      const options = { ...(nonce ? { nonce } : {}), ...(authUrl ? { authUrl } : {}) };
      assert.deepEqual(
        securityHeaders.buildGlobalSecurityHeaders(options),
        buildGlobalSecurityHeaders(options),
        JSON.stringify(options),
      );
    }
  }
});

test('surface registry and the cache decision agree', () => {
  const paths = [...PATHS, ...CLASSIFIED_PATHS, ...ENDPOINT_ROUTES];
  for (const path of paths) {
    assert.equal(surfaces.surfaceClassFor(path), surfaceClassFor(path), path);
    for (const method of ['GET', 'HEAD', 'POST']) {
      const request = new NextRequest(new URL(path, 'https://blackstory.app'), { method });
      assert.equal(
        surfaces.isPublicDocumentCacheable({ method, pathname: request.nextUrl.pathname }),
        isPublicDocumentCacheable(request),
        `${method} ${path}`,
      );
    }
  }
  assert.equal(surfaces.PUBLIC_DOCUMENT_CDN_CACHE_CONTROL, PUBLIC_DOCUMENT_CDN_CACHE_CONTROL);
});

test('staff gate paths and roles agree', () => {
  for (const path of PATHS) {
    assert.equal(staffGate.isAuthGatedPath(path), isAuthGatedPath(path), path);
  }
  // The one intended difference again: build output under the gate.
  assert.equal(isAuthGatedPath('/_next/static/a.js'), false);
  assert.equal(staffGate.isAuthGatedPath('/_expo/static/js/a.js'), false);

  for (const role of [
    'admin',
    'research',
    'publication',
    'security',
    'owner',
    '',
    'ADMIN',
    null,
    4,
  ]) {
    const metadata = { app_role: role };
    assert.equal(
      staffGate.readStaffRole(metadata),
      readSupabaseRoleFromAppMetadata(metadata),
      String(role),
    );
  }
  assert.equal(staffGate.readStaffRole(undefined), readSupabaseRoleFromAppMetadata(undefined));
});

test('request-size limit and the normalized route set agree', () => {
  for (const path of [...PATHS, '/place/x', '/stories/a', '/law/c', '/history', '/placement']) {
    assert.equal(limits.isSecurityNormalizedPath(path), isSecurityNormalizedPath(path), path);
  }
  for (const contentType of [
    null,
    'application/json',
    'Text/Plain; charset=utf-8',
    'multipart/form-data',
  ]) {
    assert.equal(
      limits.requestSizeKindForContentType(contentType),
      requestSizeKindForContentType(contentType),
      String(contentType),
    );
  }
  for (const length of [null, 0, 1, 65_535, 65_536, 65_537, 10_000_000, -1, Number.NaN]) {
    for (const kind of ['jsonBody', 'textBody'] as const) {
      assert.equal(
        !limits.isRequestTooLarge(length, kind),
        isRequestWithinLimit(length, kind),
        `${length} ${kind}`,
      );
    }
  }
});

test('the staff gate is stricter than the original only by case', () => {
  for (const path of ['/ADMIN', '/Admin/cases', '/DESIGN-SYSTEM']) {
    assert.equal(staffGate.isStaffGatePath(path), true, path);
    assert.equal(
      isAuthGatedPath(path.toLowerCase()),
      true,
      `original gates the lower-case form of ${path}`,
    );
  }
});

// ---- query normalization ----------------------------------------------------------------------

const QUERY_PATHS = [
  '/',
  '/search',
  '/records',
  '/records/',
  '/law',
  '/stories',
  '/corrections',
  '/place/some-place',
  '/place/some-place/',
  '/place/',
  '/entity/',
  '/stories/',
  '/invention/x',
  '/methodology',
  '/about',
  '/data',
  '/legal',
  '/errata',
  '/sitemap.xml',
  '/atlas/catalog',
  '/stories/a-chapter',
  '/entity/e1',
  '/some-new-page',
];

const QUERIES = [
  '',
  '?',
  '?x=1',
  '?utm_source=mail&utm_medium=x',
  '?fbclid=abc&gclid=1&ref=twitter&_ga=1',
  '?q=hello',
  '?q=%20%20hello%20%20world%20',
  '?q=hello+world',
  '?q=&kind=',
  '?q=a&q=b',
  '?kind=PERSON&era=1930S',
  '?kind=person&era=1930s&page=2',
  '?page=0',
  '?page=1',
  '?page=-5&q=x',
  '?page=99999',
  '?page=abc',
  '?state=ny',
  '?state=NYC',
  '?evidence=a',
  '?evidence=D',
  '?topic=abolition',
  '?topic=ABOLITION',
  '?topic=no-such-topic',
  '?kind=not%20a%20slug&era=-bad',
  '?kind=' + 'a'.repeat(80),
  '?q=' + 'x'.repeat(300),
  '?sort=name&q=x&junk=1',
  '?tag=a&tag=b&collection=c',
  '?target=p1&targetType=place',
  '?targetType=place&target=p1',
  '?from=list&theme=t&selected=s&q=1',
  '?floor=A&evidence=B&state=ga',
  '?_vercel_share=tok',
  '?x=1&_vercel_share=tok&_VERCEL_JWT=a&_vercel_jwt=b',
  '?kind=PERSON&_vercel_share=%20%20',
  '?b=2&a=1',
  '?a=1&b=2',
  '?q=caf%C3%A9&place=%E2%9C%93',
  '?q=%zz',
  '?q=a%26b%3Dc',
  '?UTM_SOURCE=x&Q=hello',
  '?era=1930s&era=1940s',
  '?lat=1&lng=2&zoom=3',
  '?decade=1930s&era=1930s',
];

function originalUrl(path: string, query: string): URL {
  return new URL(`https://blackstory.app${path}${query}`);
}

test('query canonicalization agrees with the original across paths and queries', () => {
  let compared = 0;
  for (const path of QUERY_PATHS) {
    for (const query of QUERIES) {
      const label = `${path}${query}`;
      const url = originalUrl(path, query);
      const sent = url.pathname;
      const searchParams = new URLSearchParams(url.search);

      assert.equal(
        queryNorm.needsQueryNormalizationRedirect({
          pathname: sent,
          search: url.search,
          searchParams,
        }),
        needsQueryNormalizationRedirect(url),
        `needs redirect: ${label}`,
      );

      const expected = buildNormalizedUrl(url);
      const actual = queryNorm.buildNormalizedUrl(sent, searchParams);
      assert.equal(actual.pathname, expected.pathname, `pathname: ${label}`);
      assert.equal(actual.search, expected.search, `search: ${label}`);

      assert.equal(
        queryNorm.normalizeQueryString(url.pathname, searchParams),
        normalizeQueryString(url.pathname, searchParams),
        `normalizeQueryString: ${label}`,
      );
      assert.equal(
        queryNorm.canonicalPathAndSearch(url.pathname, searchParams),
        canonicalPathAndSearch(url),
        `canonicalPathAndSearch: ${label}`,
      );

      // The decision a request actually gets, end to end.
      const original = handleQueryNormalization(new NextRequest(url));
      const redirect = original.headers.get('location');
      const ported = queryNorm.handleQueryNormalization({
        pathname: sent === '/' ? '/' : sent.replace(/\/+$/, '') || '/',
        trailingSlash: sent.length > 1 && sent.endsWith('/'),
        search: url.search,
        searchParams,
      });
      if (redirect === null) {
        assert.equal(ported, null, `no redirect: ${label}`);
      } else {
        const target = new URL(redirect);
        assert.equal(original.status, 308, label);
        assert.equal(ported?.status, 308, `status: ${label}`);
        assert.equal(
          ported?.headers.location,
          `${target.pathname}${target.search}`,
          `location: ${label}`,
        );
        assert.equal(
          ported?.headers['cache-control'],
          original.headers.get('cache-control'),
          label,
        );
      }
      compared += 1;
    }
  }
  assert.ok(compared > 800, `matrix size ${compared}`);
});

test('/explore is the one documented gap: the original canonicalizes it, the port passes it through', () => {
  for (const query of ['?utm_source=x', '?junk=1&era=1930s', '?lat=1&lng=2&zoom=3', '?floor=a']) {
    const url = originalUrl('/explore', query);
    assert.equal(
      queryNorm.handleQueryNormalization({
        pathname: '/explore',
        trailingSlash: false,
        search: url.search,
        searchParams: new URLSearchParams(url.search),
      }),
      null,
      query,
    );
  }
  assert.equal(needsQueryNormalizationRedirect(originalUrl('/explore', '?utm_source=x')), true);
});

test('allowlists and tracking vocabulary are identical to the originals', () => {
  assert.deepEqual([...queryNorm.SEARCH_PAGE_PARAM_ALLOWLIST], [...SEARCH_PAGE_PARAM_ALLOWLIST]);
  assert.deepEqual([...queryNorm.LAW_PAGE_PARAM_ALLOWLIST], [...LAW_PAGE_PARAM_ALLOWLIST]);
  assert.deepEqual([...queryNorm.STORIES_PAGE_PARAM_ALLOWLIST], [...STORIES_PAGE_PARAM_ALLOWLIST]);
  assert.deepEqual(
    [...queryNorm.CORRECTIONS_PAGE_PARAM_ALLOWLIST],
    [...CORRECTIONS_PAGE_PARAM_ALLOWLIST],
  );
  assert.deepEqual([...queryNorm.PLACE_PAGE_PARAM_ALLOWLIST], [...PLACE_PAGE_PARAM_ALLOWLIST]);
  assert.deepEqual(
    [...recordsQuery.RECORDS_PAGE_PARAM_ALLOWLIST],
    [...RECORDS_PAGE_PARAM_ALLOWLIST],
  );
  assert.deepEqual([...queryNorm.TRACKING_QUERY_PREFIXES], [...TRACKING_QUERY_PREFIXES]);
  assert.deepEqual([...queryNorm.TRACKING_QUERY_KEYS].sort(), [...TRACKING_QUERY_KEYS].sort());
  for (const key of ['_vercel_share', '_VERCEL_JWT', 'vercel', 'x_vercel_', '']) {
    assert.equal(
      queryNorm.isPlatformPassthroughQueryKey(key),
      isPlatformPassthroughQueryKey(key),
      key,
    );
  }
});

test('topic vocabulary snapshot equals the domain registry', () => {
  assert.deepEqual(
    [...topicIds],
    TOPIC_REGISTRY.map((topic) => topic.id),
  );
});

test('records query parsing and printing agree on a deterministic fuzz', () => {
  let seed = 20261016;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const junk = [
    '',
    ' ',
    'a',
    'A',
    'person',
    'PERSON',
    '1930s',
    '1930S',
    'NY',
    'ny',
    'nyc',
    'B',
    'b',
    'D',
    '12',
    '-3',
    '99999',
    'abc',
    'x'.repeat(200),
    ' spaced  out ',
    'caf\u00e9',
    'abolition',
    'ABOLITION',
    'nope',
  ];
  const keys = ['q', 'kind', 'era', 'state', 'topic', 'status', 'evidence', 'page'];
  for (let round = 0; round < 600; round += 1) {
    const raw: Record<string, string | string[] | undefined> = {};
    for (const key of keys) {
      const roll = next();
      if (roll < 0.25) continue;
      raw[key] = roll < 0.4 ? [pick(junk), pick(junk)] : pick(junk);
    }
    const expected = parseRecordsQuery(raw);
    assert.deepEqual(recordsQuery.parseRecordsQuery(raw), expected, JSON.stringify(raw));
    assert.equal(
      recordsQuery.recordsQueryString(expected),
      recordsQueryString(expected),
      JSON.stringify(raw),
    );
    assert.equal(recordsQuery.recordsHref(expected), recordsHref(expected), JSON.stringify(raw));
    assert.equal(
      recordsQuery.isRecordsCombinationQuery(expected),
      isRecordsCombinationQuery(expected),
      JSON.stringify(raw),
    );
  }
});

test('eligibility for public-route handling: everything the original handles, the port handles', () => {
  const eligible = site('request-limits').isSecurityNormalizedRequest;
  for (const path of [...QUERY_PATHS, ...PATHS]) {
    const sent = new URL(`https://blackstory.app${path}`).pathname;
    const facts = {
      pathname: sent.length > 1 ? sent.replace(/\/+$/, '') : sent,
      trailingSlash: sent.length > 1 && sent.endsWith('/'),
    };
    if (isSecurityNormalizedPath(sent)) {
      assert.equal(eligible(facts), true, `original handles ${sent}`);
    }
  }
});

test('eligibility differences are the documented ones: decoded paths and trailing-slash exact routes', () => {
  const eligible = site('request-limits').isSecurityNormalizedRequest;
  // Next never redirected `/methodology/` through this predicate (the framework did); Expo has no such step.
  assert.equal(isSecurityNormalizedPath('/methodology/'), false);
  assert.equal(eligible({ pathname: '/methodology', trailingSlash: true }), true);
  // The original tests the encoded pathname, so `/%73earch` escaped canonicalization (and cache keying).
  assert.equal(isSecurityNormalizedPath('/%73earch'), false);
  assert.equal(
    eligible({ pathname: '/search', trailingSlash: false }),
    true,
    'the port decodes first',
  );
  // Prefix routes behave the same either way.
  assert.equal(isSecurityNormalizedPath('/place/'), true);
  assert.equal(eligible({ pathname: '/place', trailingSlash: true }), true);
  assert.equal(isSecurityNormalizedPath('/placement/'), false);
  assert.equal(eligible({ pathname: '/placement', trailingSlash: true }), false);
});
