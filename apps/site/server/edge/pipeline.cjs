/**
 * The request pipeline that replaces apps/web/src/proxy.ts, in the same order:
 *   1. maintenance wall   (first, always; a walled request never reaches a route or `published`)
 *   2. AI/SEO-tool crawler deny on expensive paths
 *   3. staff gate for /admin and /design-system
 *   4. request-size limit on state-changing requests to public routes
 *   5. pass through to the app
 * then, on every response, the security headers (with this request's nonce) and, for cacheable
 * public documents, the CDN cache header. Pure: no sockets, so it is unit tested directly.
 */
const { handleMaintenance } = require('./maintenance.cjs');
const { denyExpensiveAiCrawler } = require('./traffic.cjs');
const { staffGate, isStaffGatePath } = require('./staff-gate.cjs');
const { buildGlobalSecurityHeaders } = require('./security-headers.cjs');
const { isPublicDocumentCacheable, PUBLIC_DOCUMENT_CDN_CACHE_CONTROL } = require('./surfaces.cjs');
const { parseCookieHeader } = require('./cookies.cjs');
const { normalizeRequestTarget } = require('./paths.cjs');
const { handleRequestSize } = require('./request-limits.cjs');

/**
 * Normalize a Node request into the plain facts the gates read. `ok:false` means the target is
 * malformed (bad percent-encoding, no leading slash); the caller answers 400.
 */
function readRequestFacts(req) {
  const target = normalizeRequestTarget(req.url);
  if (!target.ok) return { ok: false };
  const cookies = {};
  for (const { name, value } of parseCookieHeader(req.headers.cookie)) cookies[name] = value;
  return {
    ok: true,
    method: req.method ?? 'GET',
    pathname: target.pathname,
    search: target.search,
    searchParams: target.searchParams,
    headers: req.headers,
    cookies,
  };
}

/**
 * @returns {Promise<{ response: {status:number, headers:Record<string,string>, body?:string, setCookies?:string[]}|null,
 *                      setCookies: string[], securityHeaders: Array<{key:string,value:string}> }>}
 *   `response` is set when a gate answered; otherwise the caller renders the app and applies
 *   `setCookies` and `securityHeaders` (and `decorate`) to that response.
 */
async function runEdge(facts, { env = process.env, nonce, deps = {} } = {}) {
  const isAdminPath =
    facts.pathname.toLowerCase() === '/admin' || facts.pathname.toLowerCase().startsWith('/admin/');
  const authUrl = isAdminPath ? env.NEXT_PUBLIC_SUPABASE_URL : undefined;
  const securityHeaders = buildGlobalSecurityHeaders({ nonce, ...(authUrl ? { authUrl } : {}) });

  const maintenance = handleMaintenance(facts, deps.maintenanceSettings);
  if (maintenance) return { response: maintenance, setCookies: [], securityHeaders };

  const deny = denyExpensiveAiCrawler(facts);
  if (deny) return { response: deny, setCookies: [], securityHeaders };

  if (isStaffGatePath(facts.pathname)) {
    const gate = await staffGate(
      { pathname: facts.pathname, search: facts.search, headers: facts.headers },
      { env, ...(deps.createSupabaseClient ? { createClient: deps.createSupabaseClient } : {}) },
    );
    if (!gate.pass) return { response: gate.response, setCookies: [], securityHeaders };
    return { response: null, setCookies: gate.setCookies, securityHeaders };
  }

  const tooLarge = handleRequestSize(facts);
  if (tooLarge) return { response: tooLarge, setCookies: [], securityHeaders };

  return { response: null, setCookies: [], securityHeaders };
}

/** Extra headers a rendered response earns from its status and URL. */
function decorate(facts, status) {
  // A maintenance 503 or a crawler 403 is not a document; keep the header off anything >= 400.
  if (status >= 400) return {};
  if (!isPublicDocumentCacheable(facts)) return {};
  return { 'Vercel-CDN-Cache-Control': PUBLIC_DOCUMENT_CDN_CACHE_CONTROL };
}

module.exports = { readRequestFacts, runEdge, decorate };
