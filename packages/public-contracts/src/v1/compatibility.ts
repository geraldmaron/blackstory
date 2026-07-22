/**
 * Client-version-floor compatibility check — the pure, environment-neutral function both
 * `apps/api-public` (server-side enforcement, MOB-004) and `apps/mobile` (client-side self-check
 * before even calling the server, MOB-009) can share (ADR-021 §2).
 *
 * This module does NOT parse the `X-BlackStory-Client` header itself (header parsing is
 * server/HTTP-framework-specific and does not belong in an environment-neutral package) — it
 * takes an already-extracted client version string and answers one question: is it below the
 * floor. Per ADR-021's red-team resolution #2, this is a UX affordance for honest clients, not a
 * security boundary: nothing here should be treated as authorization.
 */
import { z } from 'zod';
import { API_VERSION, DEPRECATION_WINDOW_DAYS, MIN_SUPPORTED_API_VERSION } from '../version.js';

/** `platform/major.minor.patch` — e.g. `mobile/1.4.0` or `web/1.4.0` (the `api=` suffix from
 * ADR-021 §2's example header value is parsed as a separate `apiVersion` field, see
 * `clientVersionHeaderV1Schema`). */
const CLIENT_BUILD_VERSION_PATTERN = /^[a-z0-9_-]{1,40}\/\d{1,5}\.\d{1,5}\.\d{1,5}$/i;

export const clientBuildVersionSchema = z
  .string()
  .max(80)
  .refine((value) => CLIENT_BUILD_VERSION_PATTERN.test(value), {
    message: 'Expected "<platform>/<major.minor.patch>", e.g. "mobile/1.4.0"',
  });

export type ClientBuildVersion = z.infer<typeof clientBuildVersionSchema>;

export const clientVersionHeaderV1Schema = z
  .object({
    build: clientBuildVersionSchema,
    apiVersion: z.string().max(10),
  });

export type ClientVersionHeaderV1 = z.infer<typeof clientVersionHeaderV1Schema>;

function parseSemver(build: ClientBuildVersion): readonly [number, number, number] {
  const versionPart = build.split('/')[1] ?? '0.0.0';
  const [major, minor, patch] = versionPart.split('.').map((segment) => Number.parseInt(segment, 10));
  return [major ?? 0, minor ?? 0, patch ?? 0];
}

/** Semver comparison: negative if `a` < `b`, 0 if equal, positive if `a` > `b`. */
function compareSemver(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * True when `clientApiVersion` is strictly older than `floor` (defaults to
 * `MIN_SUPPORTED_API_VERSION`). Unknown/malformed API version strings are treated as
 * unsupported (fail closed toward prompting an update, never silently accepted).
 */
export function isApiVersionBelowFloor(
  clientApiVersion: string,
  floor: string = MIN_SUPPORTED_API_VERSION,
): boolean {
  const clientMajor = /^v(\d+)$/.exec(clientApiVersion)?.[1];
  const floorMajor = /^v(\d+)$/.exec(floor)?.[1];
  if (!clientMajor || !floorMajor) return true;
  return Number.parseInt(clientMajor, 10) < Number.parseInt(floorMajor, 10);
}

/** True when `minBuild`'s semver is strictly greater than `build`'s — i.e. `build` is below the
 * minimum-supported build floor for its declared API major. */
export function isBuildVersionBelowFloor(build: ClientBuildVersion, minBuild: ClientBuildVersion): boolean {
  return compareSemver(parseSemver(build), parseSemver(minBuild)) < 0;
}

export type CompatibilityCheckV1 = {
  readonly supported: boolean;
  readonly currentApiVersion: typeof API_VERSION;
  readonly minSupportedApiVersion: typeof MIN_SUPPORTED_API_VERSION;
  readonly deprecationWindowDays: typeof DEPRECATION_WINDOW_DAYS;
  /** True when the client is on a still-supported but no-longer-default major/build — the signal
   * that should surface the soft "update available" nudge (ADR-021 red-team resolution #1),
   * distinct from the hard `supported: false` floor. */
  readonly softDeprecated: boolean;
};

/**
 * Pure compatibility evaluation. `apps/api-public` calls this to decide between serving the
 * request, serving it with a `Deprecation`/`Sunset` signal, or rejecting with
 * `CLIENT_VERSION_UNSUPPORTED` (426). `apps/mobile` can call the same function client-side to
 * decide whether to show a soft nudge before the server ever says no.
 */
export function evaluateCompatibility(input: {
  readonly clientApiVersion: string;
  readonly floor?: string;
  readonly isCurrentMajor?: boolean;
}): CompatibilityCheckV1 {
  const floor = input.floor ?? MIN_SUPPORTED_API_VERSION;
  const supported = !isApiVersionBelowFloor(input.clientApiVersion, floor);
  const isCurrentMajor = input.isCurrentMajor ?? input.clientApiVersion === API_VERSION;
  return {
    supported,
    currentApiVersion: API_VERSION,
    minSupportedApiVersion: MIN_SUPPORTED_API_VERSION,
    deprecationWindowDays: DEPRECATION_WINDOW_DAYS,
    softDeprecated: supported && !isCurrentMajor,
  };
}
