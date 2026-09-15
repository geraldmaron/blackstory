/**
 * Validation for authored `bb_reference.law_applicability` rows.
 *
 * A row says a law or ruling was in force for a jurisdiction and certain groups over a window.
 * The window must come from the record's own cited claims, never from entity `statusHistory`
 * (lifecycle only, and known to carry wrong years). So every in-force year has to appear in the
 * text of at least one basis claim, and every basis claim must be a cited claim on a record in the
 * active release.
 * Method: docs/methodology/lives-across-decades.md.
 */

export const LIVES_APPLICABILITY_SLICES = ['black_nh', 'white_nh', 'hispanic', 'all'] as const;

export const LIVES_LIFE_DOMAINS = [
  'housing',
  'credit',
  'schooling',
  'work',
  'income_support',
  'voting',
  'justice',
  'family',
  'public_accommodation',
  'immigration',
] as const;

export const LIVES_TEXT_POSTURES = ['exclusionary', 'protective', 'facially_neutral'] as const;

export type AuthoredApplicability = {
  readonly id: string;
  readonly entityId: string;
  readonly jurisdictionId: string;
  readonly scopeLevel: 'federal' | 'state' | 'local';
  readonly inForceFromEdtf: string;
  readonly inForceToEdtf?: string | null;
  readonly groupsNamed?: readonly string[];
  readonly appliesToSlices: readonly string[];
  readonly lifeDomains: readonly string[];
  readonly textPosture: string;
  readonly disputed?: boolean;
  readonly basisClaimIds: readonly string[];
  readonly notes?: string | null;
  readonly status?: 'draft' | 'review' | 'published';
};

export type EdtfBounds = {
  /** Inclusive first day, YYYY-MM-DD. */
  readonly earliest: string;
  /** Inclusive last day, YYYY-MM-DD. */
  readonly latest: string;
  readonly precision: 'day' | 'month' | 'year';
  readonly year: number;
};

const EDTF_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/** Bounds of an EDTF Level 0 date (YYYY, YYYY-MM or YYYY-MM-DD) on the proleptic Gregorian calendar. */
export function edtfBounds(edtf: string): EdtfBounds {
  const match = EDTF_PATTERN.exec(edtf.trim());
  if (!match) throw new Error(`unsupported EDTF date "${edtf}" (use YYYY, YYYY-MM or YYYY-MM-DD)`);
  const year = Number(match[1]);
  const month = match[2] === undefined ? undefined : Number(match[2]);
  const day = match[3] === undefined ? undefined : Number(match[3]);
  if (month !== undefined && (month < 1 || month > 12)) throw new Error(`bad month in "${edtf}"`);
  if (month === undefined) {
    return { earliest: `${match[1]}-01-01`, latest: `${match[1]}-12-31`, precision: 'year', year };
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day === undefined) {
    return {
      earliest: `${match[1]}-${match[2]}-01`,
      latest: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
      precision: 'month',
      year,
    };
  }
  if (day < 1 || day > lastDay) throw new Error(`bad day in "${edtf}"`);
  return { earliest: edtf, latest: edtf, precision: 'day', year };
}

function nextDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return date.toISOString().slice(0, 10);
}

export type ApplicabilityContext = {
  readonly entityIds: ReadonlySet<string>;
  readonly jurisdictionIds: ReadonlySet<string>;
  /** Published claim id → the claim's object text plus citation label. */
  readonly claimText: ReadonlyMap<string, string>;
};

export type ApplicabilityDbRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly jurisdiction_id: string;
  readonly scope_level: 'federal' | 'state' | 'local';
  readonly in_force_from_edtf: string;
  readonly in_force_to_edtf: string | null;
  /** Postgres daterange literal, inclusive lower and exclusive upper. */
  readonly in_force_span: string;
  readonly date_precision: 'day' | 'month' | 'year';
  readonly groups_named: readonly string[];
  readonly applies_to_slices: readonly string[];
  readonly life_domains: readonly string[];
  readonly text_posture: string;
  readonly disputed: boolean;
  readonly basis_claim_ids: readonly string[];
  readonly notes: string | null;
  readonly status: 'draft' | 'review' | 'published';
};

export type ApplicabilityValidation =
  | { readonly ok: true; readonly row: ApplicabilityDbRow }
  | { readonly ok: false; readonly id: string; readonly errors: readonly string[] };

const SCOPE_JURISDICTION_PREFIX = {
  federal: ['nation:'],
  state: ['state:'],
  local: ['county:', 'region:', 'city:'],
} as const;

export function validateApplicability(
  input: AuthoredApplicability,
  context: ApplicabilityContext,
): ApplicabilityValidation {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9_.:-]*$/.test(input.id))
    errors.push(`id "${input.id}" is not a stable slug`);
  if (!context.entityIds.has(input.entityId)) {
    errors.push(`entity ${input.entityId} is not in the published catalog`);
  }
  if (!context.jurisdictionIds.has(input.jurisdictionId)) {
    errors.push(`jurisdiction ${input.jurisdictionId} does not exist`);
  }
  const prefixes = SCOPE_JURISDICTION_PREFIX[input.scopeLevel];
  if (!prefixes) {
    errors.push(`scope ${String(input.scopeLevel)} is not federal, state or local`);
  } else if (!prefixes.some((prefix) => input.jurisdictionId.startsWith(prefix))) {
    errors.push(`${input.scopeLevel} scope cannot sit on jurisdiction ${input.jurisdictionId}`);
  }
  for (const slice of input.appliesToSlices) {
    if (!(LIVES_APPLICABILITY_SLICES as readonly string[]).includes(slice)) {
      errors.push(`slice ${slice} is not allowed`);
    }
  }
  if (input.appliesToSlices.length === 0) errors.push('appliesToSlices is empty');
  for (const domain of input.lifeDomains) {
    if (!(LIVES_LIFE_DOMAINS as readonly string[]).includes(domain)) {
      errors.push(`life domain ${domain} is not allowed`);
    }
  }
  if (input.lifeDomains.length === 0) errors.push('lifeDomains is empty');
  if (!(LIVES_TEXT_POSTURES as readonly string[]).includes(input.textPosture)) {
    errors.push(`text posture ${input.textPosture} is not allowed`);
  }
  if (input.basisClaimIds.length === 0) errors.push('basisClaimIds is empty');
  const basisText: string[] = [];
  for (const claimId of input.basisClaimIds) {
    const text = context.claimText.get(claimId);
    if (text === undefined) errors.push(`basis claim ${claimId} is not a published claim`);
    else basisText.push(text);
  }

  let from: EdtfBounds | undefined;
  let to: EdtfBounds | undefined;
  try {
    from = edtfBounds(input.inForceFromEdtf);
  } catch (error) {
    errors.push((error as Error).message);
  }
  if (input.inForceToEdtf) {
    try {
      to = edtfBounds(input.inForceToEdtf);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  const cited = (year: number) => basisText.some((text) => text.includes(String(year)));
  if (from && basisText.length > 0 && !cited(from.year)) {
    errors.push(`in-force start year ${from.year} does not appear in any basis claim`);
  }
  if (to && basisText.length > 0 && !cited(to.year)) {
    errors.push(`in-force end year ${to.year} does not appear in any basis claim`);
  }
  if (from && to && to.latest < from.earliest) {
    errors.push(`in-force end ${input.inForceToEdtf} is before start ${input.inForceFromEdtf}`);
  }
  if (input.textPosture === 'facially_neutral' && input.disputed !== true) {
    errors.push(
      'a facially neutral rule is shown only when its disputed effect is marked disputed',
    );
  }

  if (errors.length > 0 || !from) return { ok: false, id: input.id, errors };

  return {
    ok: true,
    row: {
      id: input.id,
      entity_id: input.entityId,
      jurisdiction_id: input.jurisdictionId,
      scope_level: input.scopeLevel,
      in_force_from_edtf: input.inForceFromEdtf,
      in_force_to_edtf: input.inForceToEdtf ?? null,
      in_force_span: `[${from.earliest},${to ? nextDay(to.latest) : ''})`,
      date_precision: from.precision,
      groups_named: input.groupsNamed ?? [],
      applies_to_slices: input.appliesToSlices,
      life_domains: input.lifeDomains,
      text_posture: input.textPosture,
      disputed: input.disputed ?? false,
      basis_claim_ids: input.basisClaimIds,
      notes: input.notes ?? null,
      status: input.status ?? 'published',
    },
  };
}
