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
