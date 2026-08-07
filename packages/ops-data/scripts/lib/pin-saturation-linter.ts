/**
 * Pin-saturation linter: catches people pinned at the institution that honors them.
 *
 * repo-9ki8 found Harriet Tubman's record pinned at her visitor center. repo-x8j6 found the same
 * shape at scale: 28 Negro Leagues figures on one coordinate at the Baseball Hall of Fame, 11
 * members of Congress on the US Capitol, 10 military figures on Arlington National Cemetery.
 * Nobody was born in a hall of fame. The pin was the museum's, filed under the person's name.
 *
 * The signal is a coordinate carrying many PERSON records at a precision that asserts an exact
 * spot (`site`, `institution`, `address`, `building`, `campus`). Coarse precisions are excluded:
 * a `county` or `city` pin already tells the reader it is approximate, and NRHP records legitimately
 * share a county centroid.
 *
 * Genuine co-location exists and must not be flagged as a defect — the nine people murdered at
 * Emanuel AME really do share that address. Such coordinates are named in ALLOWED_SHARED_PINS
 * with the reason, so an exception is a reviewed decision rather than a silent pass.
 */
export type PinSaturationSeverity = 'error' | 'warn';

export type PinSaturationFinding = {
  readonly lat: number;
  readonly lng: number;
  readonly severity: PinSaturationSeverity;
  readonly code: 'people_stacked_on_exact_pin';
  readonly entityIds: readonly string[];
  readonly message: string;
};

export type PinSaturationLintInput = {
  readonly entityId: string;
  readonly kind: string;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly precision?: string | null;
};

export type PinSaturationLintReport = {
  readonly findings: readonly PinSaturationFinding[];
  readonly hasErrors: boolean;
};

/**
 * Precisions that assert "this exact spot". A person stacked here is making a claim about a
 * building; coarser precisions are honest about being approximate and are not linted.
 */
const EXACT_PRECISIONS = new Set(['site', 'institution', 'address', 'building', 'campus']);

/** More than this many people on one exact coordinate is a conflation, not a coincidence. */
export const PIN_SATURATION_ERROR_THRESHOLD = 4;
const PIN_SATURATION_WARN_THRESHOLD = 2;

/**
 * Coordinates where many people genuinely share one spot. Each needs a reason, because the whole
 * point of this linter is that "they're all associated with this place" is exactly the bad
 * argument that produced the Cooperstown pin. The bar is that the place is where the documented
 * event happened TO them, not where they are commemorated.
 */
export const ALLOWED_SHARED_PINS: readonly {
  readonly lat: number;
  readonly lng: number;
  readonly reason: string;
}[] = [
  {
    lat: 32.7875,
    lng: -79.93305556,
    reason:
      'Emanuel AME Church, Charleston — the nine people murdered there on June 17, 2015 were killed at this address. The pin is the event, not a memorial to it.',
  },
  {
    lat: 33.5167,
    lng: -86.815,
    reason:
      '16th Street Baptist Church, Birmingham — Addie Mae Collins, Carole Robertson, Cynthia Wesley, and Denise McNair were killed in the September 15, 1963 bombing at this address. Same reasoning as Emanuel AME: the place is where it happened to them.',
  },
  {
    lat: 46.7893,
    lng: -92.0968,
    reason:
      'Downtown Duluth, near the jail — Elias Clayton, Elmer Jackson, and Isaac McGhie were lynched together by a white mob at this spot on June 15, 1920. They share the pin because they were killed in the same place at the same time.',
  },
  {
    lat: 42.4534,
    lng: -76.4735,
    reason:
      'Cornell University — the seven founders of Alpha Phi Alpha founded it on this campus on December 4, 1906. Unlike Cooperstown, this is something they did here, not somewhere they were later honored. A documented birthplace would still be a better pin for each of them; see repo-x8j6.',
  },
  {
    lat: 38.9227,
    lng: -77.0194,
    reason:
      'Howard University — the founders of Omega Psi Phi (1911) and Phi Beta Sigma (1914) founded them on this campus, and Charlotte E. Ray earned her law degree here in 1872. Acts performed here, not commemoration. A documented birthplace would still be a better pin; see repo-x8j6.',
  },
];

function roundCoordinate(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function isAllowedSharedPin(lat: number, lng: number): string | undefined {
  return ALLOWED_SHARED_PINS.find(
    (allowed) =>
      roundCoordinate(allowed.lat) === roundCoordinate(lat) &&
      roundCoordinate(allowed.lng) === roundCoordinate(lng),
  )?.reason;
}

/**
 * Lints the whole catalog at once — saturation is a property of a coordinate across records, so
 * unlike lintKindHygiene this cannot be evaluated one entity at a time.
 */
export function lintPinSaturation(
  entities: readonly PinSaturationLintInput[],
): PinSaturationLintReport {
  const byCoordinate = new Map<string, PinSaturationLintInput[]>();

  for (const entity of entities) {
    if (entity.kind !== 'person') continue;
    if (entity.lat === null || entity.lng === null) continue;
    if (!Number.isFinite(entity.lat) || !Number.isFinite(entity.lng)) continue;
    if (!EXACT_PRECISIONS.has((entity.precision ?? '').trim().toLowerCase())) continue;

    const key = `${roundCoordinate(entity.lat)},${roundCoordinate(entity.lng)}`;
    const bucket = byCoordinate.get(key);
    if (bucket) bucket.push(entity);
    else byCoordinate.set(key, [entity]);
  }

  const findings: PinSaturationFinding[] = [];
  for (const [key, bucket] of byCoordinate) {
    if (bucket.length <= PIN_SATURATION_WARN_THRESHOLD) continue;
    const [latText, lngText] = key.split(',');
    const lat = Number(latText);
    const lng = Number(lngText);
    if (isAllowedSharedPin(lat, lng)) continue;

    const severity: PinSaturationSeverity =
      bucket.length >= PIN_SATURATION_ERROR_THRESHOLD ? 'error' : 'warn';
    findings.push({
      lat,
      lng,
      severity,
      code: 'people_stacked_on_exact_pin',
      entityIds: bucket.map((entity) => entity.entityId).sort(),
      message:
        `${bucket.length} person records share the exact coordinate ${lat}, ${lng} at ` +
        `precision "${bucket[0].precision}". People are not born in institutions — this is ` +
        `almost always the honoring/burial site pinned onto the person. Repoint to a place ` +
        `documented in each record, or drop the pin. If the co-location is genuine, add the ` +
        `coordinate to ALLOWED_SHARED_PINS with a reason.`,
    });
  }

  findings.sort((a, b) => b.entityIds.length - a.entityIds.length);
  return { findings, hasErrors: findings.some((finding) => finding.severity === 'error') };
}

export function pinSaturationFailureMessage(report: PinSaturationLintReport): string {
  const errors = report.findings.filter((finding) => finding.severity === 'error');
  if (errors.length === 0) return 'Pin saturation lint passed.';
  const lines = errors.map(
    (finding) =>
      `  ${finding.lat}, ${finding.lng} — ${finding.entityIds.length} people: ` +
      `${finding.entityIds.slice(0, 5).join(', ')}${finding.entityIds.length > 5 ? ', …' : ''}`,
  );
  return [`Pin saturation lint failed (${errors.length} coordinate(s)):`, ...lines].join('\n');
}
