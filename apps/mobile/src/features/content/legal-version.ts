/**
 * Legal/methodology version-matching against the bootstrap manifest (MOB-015 requirement #4).
 *
 * There are TWO checks here, deliberately kept separate because they are backed by different
 * parts of the real contract surface:
 *
 *   1. `isLegalVersionStale` — the FORWARD-COMPATIBLE, per-document check the bead describes:
 *      compare a cached legal page's own version against
 *      `MobileBootstrapManifest.legalVersions[slug]` (packages/domain/src/publication/
 *      mobile-bootstrap.ts). No live endpoint exposes `legalVersions` to mobile today — the
 *      `/v1/bootstrap` WIRE response (`BootstrapResponseV1`, src/data/contracts.ts) only forwards
 *      `apiVersion`/`minSupportedApiVersion`/`deprecationWindowDays`/`activeRelease`/
 *      `searchIndexVersion`/`contentVersion` (packages/public-contracts/src/v1/bootstrap.ts) — the
 *      fuller manifest with `legalVersions` lives only in the downloadable release-manifest
 *      artifact, which nothing in `src/data/**` currently fetches for mobile (that wiring is a
 *      `src/data/**` change, outside this bead's exclusive ownership). This function is written
 *      and tested now so a future bead that wires that fetch only has to supply the map.
 *
 *   2. `isContentVersionStale` — the check ACTUALLY WIRED into the Learn/More UI today, using
 *      fields the endpoint really does return: `contentVersion` ("present once static content —
 *      stories/methodology/etc, see content.ts — is release-versioned") and, when absent,
 *      `activeRelease.releaseId` as a coarser fallback. A cached legal/methodology page stamps
 *      the content version that was active when it was fetched (see `content-repository.ts`); if
 *      the most recently observed bootstrap content version differs, the UI shows "this version
 *      may be outdated — view current" (see `ContentRenderer.tsx`) instead of silently serving
 *      stale legal text (ADR-022 §3's "no silent failures" / "cached content ... explicitly
 *      labeled" behavioral contract, sharpened for legal content specifically).
 */
import type { MobileLegalVersions } from './content-types';

/**
 * Forward-compatible per-slug check. Returns `false` (not stale) when `currentVersions` doesn't
 * carry an entry for `slug` at all — an unknown-safe default so the UI never cries wolf about a
 * document the manifest hasn't told it anything about.
 */
export function isLegalVersionStale(
  cachedVersion: string | undefined,
  currentVersions: MobileLegalVersions | undefined,
  slug: string,
): boolean {
  if (!currentVersions) return false;
  const current = currentVersions[slug];
  if (current === undefined) return false;
  if (cachedVersion === undefined) return true; // no known cached version at all ⇒ treat as stale
  return current !== cachedVersion;
}

/**
 * The runtime check actually wired today: compares the content-version stamp recorded when a
 * page was cached against the most recently observed bootstrap content version. `undefined` on
 * either side means "unknown" and is treated as NOT stale (never invent a false-positive warning
 * from missing data) — the honest offline/degraded state is handled separately by the cache's own
 * `FreshnessSignal`, not by this comparison.
 */
export function isContentVersionStale(
  cachedContentVersion: string | undefined,
  currentContentVersion: string | undefined,
): boolean {
  if (cachedContentVersion === undefined || currentContentVersion === undefined) return false;
  return cachedContentVersion !== currentContentVersion;
}
