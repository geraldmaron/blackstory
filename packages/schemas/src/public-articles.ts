/**
 * Canonical public Article projection contract.
 *
 * An Article is the single long-form publication surface that replaces the old
 * split /themes + /stories + /topics presentation. One article renders as:
 * title -> hero image -> summary -> a typed body (prose with inline citations,
 * figures, stat callouts, primary-document quotes, timelines, map insets,
 * disputes, images) -> a numbered references section.
 *
 * Body blocks that read the evidence store reference a theme-impact packet by
 * `packetId` (+ `refId` for a single row), mirroring how story-section "moments"
 * bind to packets today — the packet remains the internal source of truth and
 * its provenance is folded into the rendered reference list at read time.
 *
 * Inline prose citations use `[ref:<id>]` markers whose `<id>` must match a
 * `references[].id` on the same article; `assertArticleCitationIntegrity`
 * enforces that (the promote gate and tests call it).
 */
import { z } from 'zod';

/**
 * Mirrors ThemeImpactThemeId / THEME_IMPACT_THEME_IDS from
 * packages/domain/src/statistics/theme-impact-questions.ts. Kept as a local
 * literal (not imported) so schemas keeps no reverse dependency on @repo/domain
 * — same convention as public-projections.ts. Keep in sync with that file.
 */
const ARTICLE_THEME_IDS_MIRROR = [
  'redlining',
  'drug_policy_state',
  'urban_renewal',
  'mass_incarceration',
  'environmental_racism',
  'school_segregation',
  'voting_rights',
  'wealth_gap',
  'cross_cutting',
] as const;

const articleThemeIdSchema = z.enum(ARTICLE_THEME_IDS_MIRROR);

/** Reusable image shape — mirrors the entity `primaryImage` rights model. */
export const articleImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().min(1),
  credit: z.string().min(1),
  rightsStatus: z.enum(['public_domain', 'licensed', 'fair_use']),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  objectPath: z.string().min(1).optional(),
});
export type ArticleImageDoc = z.infer<typeof articleImageSchema>;

/**
 * One entry in the article's numbered references section. `id` is the stable
 * slug that inline `[ref:<id>]` markers point at; `locator` narrows to a page,
 * clause, or table within the cited source.
 */
export const articleReferenceSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().min(1).max(240),
  url: z.string().url().max(2048),
  locator: z.string().min(1).max(240).optional(),
});
export type ArticleReferenceDoc = z.infer<typeof articleReferenceSchema>;

/* ------------------------------------------------------------------------- *
 * Body blocks — discriminated on `type`.
 * ------------------------------------------------------------------------- */

/** A heading within the body. `level` maps to <h2>/<h3>. */
const articleHeadingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().min(1).max(240),
});

/** A prose paragraph. `text` may embed `[ref:<id>]` inline-citation markers. */
const articleParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1),
});

/** A block quotation, optionally attributed. */
const articlePullQuoteBlockSchema = z.object({
  type: z.literal('pullquote'),
  text: z.string().min(1).max(600),
  attribution: z.string().min(1).max(240).optional(),
});

/**
 * A metric figure rendered as a chart from a packet's cited observations. When
 * `metricIds` is omitted the renderer charts every time-series metric on the
 * packet; provide it to pin the figure to specific series.
 */
const articleFigureBlockSchema = z.object({
  type: z.literal('figure'),
  packetId: z.string().min(1),
  metricIds: z.array(z.string().min(1)).min(1).optional(),
  caption: z.string().min(1).max(400),
});

/** A single-observation callout (rendered as a DataMoment). */
const articleStatBlockSchema = z.object({
  type: z.literal('stat'),
  packetId: z.string().min(1),
  kind: z.enum(['observation', 'derived']),
  refId: z.string().min(1),
  caption: z.string().min(1).max(400).optional(),
});

/** A primary-document excerpt drawn from a packet artifact. */
const articlePrimaryDocumentBlockSchema = z.object({
  type: z.literal('primaryDocument'),
  packetId: z.string().min(1),
  refId: z.string().min(1),
  quote: z.string().min(1).max(1200).optional(),
});

/** A dated event timeline sourced from a packet's dated artifacts. */
const articleTimelineBlockSchema = z.object({
  type: z.literal('timeline'),
  packetId: z.string().min(1),
});

/** A single geo-anchored entity pinned on a small map inset. */
const articleMapInsetBlockSchema = z.object({
  type: z.literal('mapInset'),
  entityId: z.string().min(1),
  label: z.string().min(1).max(240).optional(),
});

/** A two-source dispute surfaced inline. */
const articleDisputeBlockSchema = z.object({
  type: z.literal('dispute'),
  label: z.string().min(1).max(240),
  sideA: z.object({ sourceLabel: z.string().min(1), claim: z.string().min(1) }),
  sideB: z.object({ sourceLabel: z.string().min(1), claim: z.string().min(1) }),
});

/** An inline image with a caption. */
const articleImageBlockSchema = z.object({
  type: z.literal('image'),
  image: articleImageSchema,
  caption: z.string().min(1).max(400).optional(),
});

export const articleBodyBlockSchema = z.discriminatedUnion('type', [
  articleHeadingBlockSchema,
  articleParagraphBlockSchema,
  articlePullQuoteBlockSchema,
  articleFigureBlockSchema,
  articleStatBlockSchema,
  articlePrimaryDocumentBlockSchema,
  articleTimelineBlockSchema,
  articleMapInsetBlockSchema,
  articleDisputeBlockSchema,
  articleImageBlockSchema,
]);
export type ArticleBodyBlockDoc = z.infer<typeof articleBodyBlockSchema>;

/* ------------------------------------------------------------------------- *
 * Article projection.
 * ------------------------------------------------------------------------- */

export const publicArticleProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(600),
  heroImage: articleImageSchema.optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  eraLabel: z.string().min(1).max(80),
  placeLabel: z.string().min(1).max(120),
  themeId: articleThemeIdSchema.optional(),
  body: z.array(articleBodyBlockSchema).min(1),
  references: z.array(articleReferenceSchema).default([]),
  relatedEntityIds: z.array(z.string().min(1)).default([]),
});
export type PublicArticleProjectionDoc = z.infer<typeof publicArticleProjectionSchema>;

/** Thin list-item projection for the `/articles` index — no body or references. */
export const publicArticleListItemSchema = publicArticleProjectionSchema.omit({
  body: true,
  references: true,
  relatedEntityIds: true,
});
export type PublicArticleListItemDoc = z.infer<typeof publicArticleListItemSchema>;

/* ------------------------------------------------------------------------- *
 * Citation integrity.
 * ------------------------------------------------------------------------- */

const INLINE_CITATION_PATTERN = /\[ref:([a-z0-9]+(?:-[a-z0-9]+)*)\]/g;

/** Every distinct `[ref:<id>]` id used in a block of prose text. */
export function extractInlineCitationIds(text: string): readonly string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(INLINE_CITATION_PATTERN)) {
    ids.add(match[1]!);
  }
  return [...ids];
}

export type ArticleCitationIntegrityIssue =
  | { readonly kind: 'unknown_reference'; readonly refId: string }
  | { readonly kind: 'unused_reference'; readonly refId: string };

/**
 * Check that inline `[ref:<id>]` markers and the `references[]` list agree:
 * every marker resolves to a reference, and every authored reference is either
 * cited inline or attached to a data block (data-block provenance is folded in
 * by the renderer, so references backing figures/stats are considered used when
 * `dataBackedRefIds` includes them).
 */
export function collectArticleCitationIssues(
  article: Pick<PublicArticleProjectionDoc, 'body' | 'references'>,
  dataBackedRefIds: readonly string[] = [],
): readonly ArticleCitationIntegrityIssue[] {
  const referenceIds = new Set(article.references.map((ref) => ref.id));
  const usedIds = new Set<string>(dataBackedRefIds);
  const issues: ArticleCitationIntegrityIssue[] = [];

  for (const block of article.body) {
    if (block.type !== 'paragraph' && block.type !== 'pullquote') continue;
    for (const refId of extractInlineCitationIds(block.text)) {
      usedIds.add(refId);
      if (!referenceIds.has(refId)) {
        issues.push({ kind: 'unknown_reference', refId });
      }
    }
  }

  for (const ref of article.references) {
    if (!usedIds.has(ref.id)) {
      issues.push({ kind: 'unused_reference', refId: ref.id });
    }
  }

  return issues;
}

/** Throws when inline citations and references disagree. Promote-gate hook. */
export function assertArticleCitationIntegrity(
  article: Pick<PublicArticleProjectionDoc, 'body' | 'references'>,
  dataBackedRefIds: readonly string[] = [],
): void {
  const issues = collectArticleCitationIssues(article, dataBackedRefIds);
  if (issues.length === 0) return;
  const detail = issues
    .map((issue) =>
      issue.kind === 'unknown_reference'
        ? `inline [ref:${issue.refId}] has no matching reference`
        : `reference "${issue.refId}" is never cited`,
    )
    .join('; ');
  throw new Error(`article citation integrity failed: ${detail}`);
}
