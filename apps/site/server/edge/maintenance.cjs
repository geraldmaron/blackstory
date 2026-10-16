/**
 * Maintenance wall. Port of apps/web/src/lib/maintenance/{maintenance-policy,maintenance-gate,
 * maintenance-page}.ts. One difference on purpose: the static-asset exemption is `/_expo/static`
 * (Expo's build output), where Next's was `/_next/static` and `/_next/image`.
 *
 * Runs first, before any route, render or data read; staff are not exempt (they redeem the same
 * bypass token as anyone let through on purpose).
 */
const { secureCookieDefaults, serializeSetCookie } = require('./cookies.cjs');

const MAINTENANCE_BYPASS_COOKIE = 'bs_maint_bypass';
const MAINTENANCE_BYPASS_HINT_COOKIE = 'bs_maint_bypass_hint';
const MAINTENANCE_BYPASS_PARAM = 'maintenance_bypass';
const MAINTENANCE_BYPASS_HEADER = 'x-maintenance-bypass';
const MAINTENANCE_BYPASS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_RETRY_AFTER_SECONDS = 86_400;

const ALWAYS_ALLOWED_PREFIXES = ['/_expo/static', '/brand/'];
const ALWAYS_ALLOWED_EXACT = ['/favicon.ico'];

const PRODUCT_NAME = 'BlackStory';
const LOCKUP = { light: '/brand/lockup-light.png', dark: '/brand/lockup-dark.png' };

function isTruthyFlag(raw) {
  if (typeof raw !== 'string') return false;
  const value = raw.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'enabled';
}

function parseRetryAfter(raw) {
  const parsed = Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETRY_AFTER_SECONDS;
  return Math.min(parsed, 60 * 60 * 24 * 7);
}

function readMaintenanceSettings(env = process.env) {
  const message = env.MAINTENANCE_MESSAGE?.trim();
  return {
    enabled: isTruthyFlag(env.MAINTENANCE_MODE),
    bypassToken: (env.MAINTENANCE_BYPASS_TOKEN ?? '').trim(),
    retryAfterSeconds: parseRetryAfter(env.MAINTENANCE_RETRY_AFTER_SECONDS),
    ...(message ? { message } : {}),
  };
}

function isMaintenanceExemptPath(pathname) {
  if (ALWAYS_ALLOWED_EXACT.includes(pathname)) return true;
  return ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Constant-time comparison over UTF-8 bytes, so the bypass token is not leaked by timing. */
function secretsMatch(candidate, expected) {
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(expected);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < b.length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

/** @returns {{kind:'pass'|'bypass'|'grant-bypass'|'block'}} */
function decideMaintenance(settings, facts) {
  if (!settings.enabled) return { kind: 'pass' };
  if (isMaintenanceExemptPath(facts.pathname)) return { kind: 'pass' };
  const { bypassToken } = settings;
  if (bypassToken.length === 0) return { kind: 'block' };
  if (facts.bypassParam !== null && secretsMatch(facts.bypassParam, bypassToken))
    return { kind: 'grant-bypass' };
  if (facts.bypassCookie !== null && secretsMatch(facts.bypassCookie, bypassToken))
    return { kind: 'bypass' };
  if (facts.bypassHeader !== null && secretsMatch(facts.bypassHeader, bypassToken))
    return { kind: 'bypass' };
  return { kind: 'block' };
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Deliberately vague at the top end: a missed countdown reads worse than none. */
function describeRetryWindow(seconds) {
  if (seconds <= 60 * 60) return 'within the hour';
  if (seconds <= 60 * 60 * 24) return 'later today';
  return 'in a few days';
}

const DEFAULT_MESSAGE =
  'BlackStory is offline while we rework how the archive stores and serves its records. ' +
  'Nothing has been lost. The records, the sources, and the corrections queue are all intact — ' +
  'what is changing is the plumbing underneath them.';

/** One self-contained document: no stylesheet, script or font request. Copy and styles match the Next page. */
function renderMaintenancePage({ message, retryAfterSeconds }) {
  const text = escapeHtml(message ?? DEFAULT_MESSAGE);
  const title = escapeHtml(`${PRODUCT_NAME} — under maintenance`);
  const lockupLight = escapeHtml(LOCKUP.light);
  const lockupDark = escapeHtml(LOCKUP.dark);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F4EFE5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)">
<title>${title}</title>
<style>
:root {
  --ink: #0A0A0A;
  --paper: #F4EFE5;
  --surface: #FBF8F2;
  --copper: #8E4F2A;
  --stone: #6D675F;
  --rule: #D7D0C4;
  --sans: "Schibsted Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  --serif: Newsreader, ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #F4EFE5;
    --paper: #0A0A0A;
    --surface: #161616;
    --copper: #D07A32;
    --stone: #948D83;
    --rule: #2A2724;
  }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--serif);
  -webkit-font-smoothing: antialiased;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
}
main {
  width: 100%;
  max-width: 34rem;
  text-align: left;
}
.lockup {
  display: block;
  width: min(18rem, 100%);
  height: auto;
  margin: -3rem 0 0.5rem -2.6rem;
}
h1 {
  font-family: var(--sans);
  font-weight: 600;
  font-size: clamp(1.75rem, 1.2rem + 2.2vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 0 0 1.25rem;
  text-wrap: balance;
}
p {
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--stone);
  margin: 0 0 1.25rem;
}
.return {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 1rem;
  color: var(--copper);
  margin: 0;
}
hr {
  border: 0;
  border-top: 1px solid var(--rule);
  margin: 2.5rem 0 1rem;
}
.status {
  font-family: var(--mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--stone);
  margin: 0;
}
@media (prefers-reduced-motion: no-preference) {
  main { animation: rise 420ms ease-out both; }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: none; }
}
</style>
</head>
<body>
<main>
  <picture>
    <source srcset="${lockupDark}" media="(prefers-color-scheme: dark)">
    <img class="lockup" src="${lockupLight}" alt="${escapeHtml(PRODUCT_NAME)}" width="800" height="450">
  </picture>
  <h1>The archive is closed for maintenance.</h1>
  <p>${text}</p>
  <p class="return">We will be back. Check again ${escapeHtml(describeRetryWindow(retryAfterSeconds))}.</p>
  <hr>
  <p class="status">HTTP 503 · SERVICE TEMPORARILY UNAVAILABLE</p>
</main>
</body>
</html>`;
}

/**
 * @param {{pathname:string, searchParams:URLSearchParams, headers:Record<string,string>, cookies:Record<string,string>}} request
 * @returns {{status:number, headers:Record<string,string>, body?:string, setCookies?:string[]}|null}
 */
function handleMaintenance(request, settings = readMaintenanceSettings()) {
  const decision = decideMaintenance(settings, {
    pathname: request.pathname,
    bypassParam: request.searchParams.get(MAINTENANCE_BYPASS_PARAM),
    bypassCookie: request.cookies[MAINTENANCE_BYPASS_COOKIE] ?? null,
    bypassHeader: request.headers[MAINTENANCE_BYPASS_HEADER] ?? null,
  });
  switch (decision.kind) {
    case 'pass':
    case 'bypass':
      return null;
    case 'grant-bypass': {
      const rest = new URLSearchParams(request.searchParams);
      rest.delete(MAINTENANCE_BYPASS_PARAM);
      const query = rest.toString();
      return {
        status: 307,
        headers: {
          location: `/${request.pathname.replace(/^\/+/, '')}${query ? `?${query}` : ''}`,
          'cache-control': 'no-store',
        },
        setCookies: [
          serializeSetCookie(
            MAINTENANCE_BYPASS_COOKIE,
            settings.bypassToken,
            secureCookieDefaults({ maxAge: MAINTENANCE_BYPASS_MAX_AGE_SECONDS }),
          ),
          serializeSetCookie(
            MAINTENANCE_BYPASS_HINT_COOKIE,
            '1',
            secureCookieDefaults({ httpOnly: false, maxAge: MAINTENANCE_BYPASS_MAX_AGE_SECONDS }),
          ),
        ],
      };
    }
    case 'block':
      return {
        status: 503,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'retry-after': String(settings.retryAfterSeconds),
          'cache-control': 'no-store, must-revalidate',
          vary: 'Cookie',
          'x-robots-tag': 'noindex, nofollow',
        },
        body: renderMaintenancePage({
          retryAfterSeconds: settings.retryAfterSeconds,
          ...(settings.message ? { message: settings.message } : {}),
        }),
      };
  }
  return null;
}

module.exports = {
  MAINTENANCE_BYPASS_COOKIE,
  MAINTENANCE_BYPASS_PARAM,
  MAINTENANCE_BYPASS_HEADER,
  readMaintenanceSettings,
  isMaintenanceExemptPath,
  decideMaintenance,
  secretsMatch,
  renderMaintenancePage,
  describeRetryWindow,
  escapeHtml,
  handleMaintenance,
};
