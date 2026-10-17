/**
 * Request-target normalization, run before any gate so a gate and the router cannot disagree about
 * which route a request is for. Every decision (maintenance wall, crawler deny, staff gate, cache
 * policy) is made on the normalized path:
 *   - percent-encoding is decoded (`/%61dmin` is `/admin`), dot segments resolved, slashes collapsed;
 *   - Expo's loader data endpoint `/_expo/loaders/<route>` is treated as `<route>` for the gates
 *     (the adapter executes that route's loader, so a staff route's data must be as gated as its
 *     page) and flagged `isLoader`, so query canonicalization never redirects a data request to HTML;
 *   - a malformed target is reported, never thrown.
 */

const LOADER_PREFIX = '/_expo/loaders';

/**
 * @param {string|undefined} target the raw request target, e.g. `/records?era=1930s`
 * @returns {{ok:true, pathname:string, trailingSlash:boolean, isLoader:boolean, search:string, searchParams:URLSearchParams} | {ok:false}}
 */
function normalizeRequestTarget(target) {
  if (typeof target !== 'string' || !target.startsWith('/')) return { ok: false };
  let url;
  try {
    // Prefixing a host keeps `//evil.example/x` a path, not an authority.
    url = new URL(`http://localhost${target}`);
  } catch {
    return { ok: false };
  }
  const segments = [];
  for (const raw of url.pathname.split('/')) {
    let segment;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return { ok: false };
    }
    // A decoded slash or backslash would change the route; refuse rather than guess.
    if (segment.includes('/') || segment.includes('\\') || segment.includes('\0'))
      return { ok: false };
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  let pathname = `/${segments.join('/')}`;
  let isLoader = false;
  if (pathname === LOADER_PREFIX || pathname.startsWith(`${LOADER_PREFIX}/`)) {
    pathname = pathname.slice(LOADER_PREFIX.length) || '/';
    isLoader = true;
  }
  // Whether the client sent a trailing slash (the canonicalizer redirects it away); `/` itself has none.
  const trailingSlash = url.pathname.length > 1 && url.pathname.endsWith('/') && pathname !== '/';
  return {
    ok: true,
    pathname,
    trailingSlash,
    isLoader,
    search: url.search,
    searchParams: url.searchParams,
  };
}

module.exports = { normalizeRequestTarget };
