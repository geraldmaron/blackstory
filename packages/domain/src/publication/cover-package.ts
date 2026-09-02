/**
 * Fail-closed article cover package: human brief, closed recipe, plate citing
 * a versioned house lock, kicker, and headline. No brief, no cover.
 */

export const COVER_PACKAGE_KIND = 'article.cover.package.v1' as const;

/** Closed recipes. A plate that is not one of these four is not a house cover. */
export const COVER_RECIPES = [
  'object-as-metaphor',
  'scene',
  'character',
  'doodle-diagram',
] as const;

export type CoverRecipe = (typeof COVER_RECIPES)[number];

/** Content helper text. These strings are the brief, not a style memo. */
export const COVER_BRIEF_HELPERS = {
  situation: 'who is this for, and what are they stuck in? A person, not a topic.',
  metaphor: 'the picture that asks the question. If you can google it, start over.',
  refuse: "name the stock photo so we don't ship it.",
} as const;

export type CoverBriefField = keyof typeof COVER_BRIEF_HELPERS;

/**
 * Versioned house lock. The lock is a scan of dry felt-tip on cream paper,
 * not a prompt. Design drops the first scan into the slot path.
 */
export type CoverLockEntry = {
  readonly version: string;
  readonly cite: string;
  readonly path: string;
  readonly publicPath: string;
  readonly label: string;
  readonly medium: string;
};

export const COVER_LOCK_REGISTRY: readonly CoverLockEntry[] = Object.freeze([
  Object.freeze({
    version: 'v1',
    cite: 'cover-lock/v1',
    path: 'brand/cover-lock/v1',
    publicPath: '/cover-lock/v1',
    label: 'House lock v1',
    medium: 'dry felt-tip on cream paper',
  }),
]);

export const COVER_LOCK_CURRENT = COVER_LOCK_REGISTRY[0]!;

const STOCK_LIBRARY_MARKERS: readonly string[] = [
  'unsplash',
  'gettyimages',
  'getty-images',
  'getty images',
  'shutterstock',
  'pexels',
  'istock',
  'istockphoto',
  'adobe stock',
  'adobestock',
  'stock.adobe',
  'dreamstime',
  'alamy',
  'depositphotos',
  'midjourney',
  'dall-e',
  'dalle',
  'stable diffusion',
  'stablediffusion',
  'openai.com',
  'stock-photo',
  'stockphoto',
  'ai-generated',
  'ai generated',
];

export type CoverBrief = {
  readonly situation: string;
  readonly metaphor: string;
  readonly refuse: string;
};

export type CoverPlate = {
  readonly assetName: string;
  readonly lockCite: string;
  readonly sourceUrl?: string;
  readonly alt?: string;
};

export type CoverPackage = {
  readonly kind: typeof COVER_PACKAGE_KIND;
  readonly brief: CoverBrief;
  readonly recipe: CoverRecipe;
  readonly plate: CoverPlate;
  readonly kicker: string;
  readonly headline: string;
};

/** Loose input from a form or API. Missing fields fail closed. */
export type CoverPackageInput = {
  readonly brief?: {
    readonly situation?: string;
    readonly metaphor?: string;
    readonly refuse?: string;
  };
  readonly recipe?: string;
  readonly plate?: {
    readonly assetName?: string;
    readonly lockCite?: string;
    readonly sourceUrl?: string;
    readonly alt?: string;
  };
  readonly kicker?: string;
  readonly headline?: string;
};

export type CoverPackageIssueCode =
  | 'brief.situation'
  | 'brief.metaphor'
  | 'brief.refuse'
  | 'recipe'
  | 'plate'
  | 'plate.lock_cite'
  | 'plate.stock'
  | 'plate.refuse'
  | 'kicker'
  | 'headline';

export type CoverPackageIssue = {
  readonly code: CoverPackageIssueCode;
  readonly message: string;
};

export type CoverPackageEvaluation =
  | { readonly ok: true; readonly cover: CoverPackage; readonly issues: readonly [] }
  | {
      readonly ok: false;
      readonly cover?: undefined;
      readonly issues: readonly CoverPackageIssue[];
    };

export class CoverPackagePublishError extends Error {
  readonly issues: readonly CoverPackageIssue[];

  constructor(issues: readonly CoverPackageIssue[]) {
    super(
      issues.length === 0
        ? 'Cover package cannot publish.'
        : `Cover package cannot publish: ${issues.map((issue) => issue.message).join(' ')}`,
    );
    this.name = 'CoverPackagePublishError';
    this.issues = issues;
  }
}

export function isCoverRecipe(value: string): value is CoverRecipe {
  return (COVER_RECIPES as readonly string[]).includes(value);
}

export function findCoverLock(cite: string): CoverLockEntry | undefined {
  const normalized = cite.trim().toLowerCase();
  if (!normalized) return undefined;
  return COVER_LOCK_REGISTRY.find(
    (entry) =>
      entry.cite === normalized ||
      entry.version === normalized ||
      entry.path === normalized ||
      entry.publicPath === normalized,
  );
}

function trimField(value: string | undefined): string {
  return value?.trim() ?? '';
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_./\\-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plateCorpus(plate: CoverPackageInput['plate']): string {
  return [plate?.assetName, plate?.sourceUrl, plate?.alt].filter(Boolean).join(' ');
}

function looksLikeStockLibrary(corpus: string): boolean {
  const key = normalizeKey(corpus);
  if (!key) return false;
  return STOCK_LIBRARY_MARKERS.some((marker) => key.includes(normalizeKey(marker)));
}

function plateMatchesNamedRefuse(corpus: string, refuse: string): boolean {
  const plateKey = normalizeKey(corpus);
  const refuseKey = normalizeKey(refuse);
  if (!plateKey || !refuseKey) return false;
  if (plateKey.includes(refuseKey)) return true;
  const assetKey = normalizeKey(corpus.split(/[/?#]/)[0] ?? '');
  if (assetKey.length >= 12 && refuseKey.includes(assetKey)) return true;
  return false;
}

const BRIEF_MIN = 12;
const KICKER_MIN = 2;
const HEADLINE_MIN = 4;

/**
 * Evaluate a cover package. Missing brief, recipe, plate+lock cite, kicker,
 * or headline fails closed. A plate without a lock cite, or one that looks
 * like the named stock photo, fails closed.
 */
export function evaluateCoverPackage(
  input: CoverPackageInput | null | undefined,
): CoverPackageEvaluation {
  const issues: CoverPackageIssue[] = [];
  const situation = trimField(input?.brief?.situation);
  const metaphor = trimField(input?.brief?.metaphor);
  const refuse = trimField(input?.brief?.refuse);
  const recipe = trimField(input?.recipe);
  const kicker = trimField(input?.kicker);
  const headline = trimField(input?.headline);
  const assetName = trimField(input?.plate?.assetName);
  const lockCite = trimField(input?.plate?.lockCite);
  const sourceUrl = trimField(input?.plate?.sourceUrl);
  const alt = trimField(input?.plate?.alt);
  const corpus = plateCorpus({ assetName, sourceUrl, alt, lockCite });

  if (situation.length < BRIEF_MIN) {
    issues.push({
      code: 'brief.situation',
      message: 'Situation is required. Name a person and what they are stuck in, not a topic.',
    });
  }
  if (metaphor.length < BRIEF_MIN) {
    issues.push({
      code: 'brief.metaphor',
      message: 'Metaphor is required. Name the picture that asks the question.',
    });
  }
  if (refuse.length < BRIEF_MIN) {
    issues.push({
      code: 'brief.refuse',
      message: 'Refuse is required. Name the stock photo so we do not ship it.',
    });
  }
  if (!isCoverRecipe(recipe)) {
    issues.push({
      code: 'recipe',
      message: 'Recipe must be one of object-as-metaphor, scene, character, or doodle-diagram.',
    });
  }
  if (!assetName) {
    issues.push({
      code: 'plate',
      message: 'Plate is required. Upload the felt-tip drawing, not a topic thumbnail.',
    });
  }
  const lock = findCoverLock(lockCite);
  if (!lock) {
    issues.push({
      code: 'plate.lock_cite',
      message: 'Plate must cite a versioned house lock. No lock citation, no cover.',
    });
  }
  if (looksLikeStockLibrary(corpus)) {
    issues.push({
      code: 'plate.stock',
      message: 'Plate looks like a stock or generated library image. Draw against the house lock.',
    });
  }
  if (refuse && plateMatchesNamedRefuse(corpus, refuse)) {
    issues.push({
      code: 'plate.refuse',
      message: 'Plate matches the named stock photo in refuse. That picture does not ship.',
    });
  }
  if (kicker.length < KICKER_MIN) {
    issues.push({
      code: 'kicker',
      message: 'Kicker is required. It sits under the plate, not as a topic label.',
    });
  }
  if (headline.length < HEADLINE_MIN) {
    issues.push({
      code: 'headline',
      message: 'Headline is required. It sits under the plate with the kicker.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  const cover: CoverPackage = Object.freeze({
    kind: COVER_PACKAGE_KIND,
    brief: Object.freeze({ situation, metaphor, refuse }),
    recipe: recipe as CoverRecipe,
    plate: Object.freeze({
      assetName,
      lockCite: lock!.cite,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(alt ? { alt } : {}),
    }),
    kicker,
    headline,
  });
  return { ok: true, cover, issues: Object.freeze([]) };
}

/** Throws when the package cannot publish. Callers must not proceed on throw. */
export function assertCoverPackageForPublish(
  input: CoverPackageInput | null | undefined,
): CoverPackage {
  const result = evaluateCoverPackage(input);
  if (!result.ok) {
    throw new CoverPackagePublishError(result.issues);
  }
  return result.cover;
}

/** Read a cover package from form fields used by the admin article form. */
export function coverPackageInputFromFields(fields: {
  readonly situation?: string;
  readonly metaphor?: string;
  readonly refuse?: string;
  readonly recipe?: string;
  readonly plateAssetName?: string;
  readonly plateLockCite?: string;
  readonly plateSourceUrl?: string;
  readonly plateAlt?: string;
  readonly kicker?: string;
  readonly headline?: string;
}): CoverPackageInput {
  return {
    brief: {
      ...(fields.situation !== undefined ? { situation: fields.situation } : {}),
      ...(fields.metaphor !== undefined ? { metaphor: fields.metaphor } : {}),
      ...(fields.refuse !== undefined ? { refuse: fields.refuse } : {}),
    },
    ...(fields.recipe !== undefined ? { recipe: fields.recipe } : {}),
    plate: {
      ...(fields.plateAssetName !== undefined ? { assetName: fields.plateAssetName } : {}),
      ...(fields.plateLockCite !== undefined ? { lockCite: fields.plateLockCite } : {}),
      ...(fields.plateSourceUrl !== undefined ? { sourceUrl: fields.plateSourceUrl } : {}),
      ...(fields.plateAlt !== undefined ? { alt: fields.plateAlt } : {}),
    },
    ...(fields.kicker !== undefined ? { kicker: fields.kicker } : {}),
    ...(fields.headline !== undefined ? { headline: fields.headline } : {}),
  };
}
