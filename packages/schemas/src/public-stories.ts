/**
 * Canonical public Story projection contract.
 *
 * An Story is the single long-form publication surface that replaces the old
 * split /themes + /stories + /topics presentation. One story renders as:
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
 * `references[].id` on the same story; `assertStoryCitationIntegrity`
 * enforces that (the promote gate and tests call it).
 */
import { z } from 'zod';

/**
 * Mirrors ThemeImpactThemeId / THEME_IMPACT_THEME_IDS from
 * packages/domain/src/statistics/theme-impact-questions.ts. Kept as a local
 * literal (not imported) so schemas keeps no reverse dependency on @repo/domain
 * — same convention as public-projections.ts. Keep in sync with that file.
 */
export const STORY_THEME_IDS = [
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

const storyThemeIdSchema = z.enum(STORY_THEME_IDS);

/** Reusable image shape — mirrors the entity `primaryImage` rights model. */
export const storyImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().min(1),
  credit: z.string().min(1),
  rightsStatus: z.enum(['public_domain', 'licensed', 'fair_use']),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  objectPath: z.string().min(1).optional(),
});
export type StoryImageDoc = z.infer<typeof storyImageSchema>;

/**
 * Optional scholarly-citation metadata for a reference whose source is a peer-reviewed
 * paper (criterion 2). When present, `doi` is checked against Crossref/OpenAlex at
 * validate time (gated behind CHECK_DOIS=1 — see checkDoiCitation in @repo/domain and
 * the validate wiring in ops-data/scripts/stories.ts) so a citation can't silently drift
 * or be fabricated with a plausible-looking DOI attached.
 */
export const storyScholarlyCitationSchema = z.object({
  doi: z.string().min(1).max(200),
  title: z.string().min(1).max(400),
  firstAuthorSurname: z.string().min(1).max(120),
  venue: z.string().min(1).max(240),
});
export type StoryScholarlyCitationDoc = z.infer<typeof storyScholarlyCitationSchema>;

/**
 * One entry in the story's numbered references section. `id` is the stable
 * slug that inline `[ref:<id>]` markers point at; `locator` narrows to a page,
 * clause, or table within the cited source.
 */
export const storyReferenceSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().min(1).max(240),
  url: z.string().url().max(2048),
  locator: z.string().min(1).max(240).optional(),
  scholarlyCitation: storyScholarlyCitationSchema.optional(),
});
export type StoryReferenceDoc = z.infer<typeof storyReferenceSchema>;

/**
 * A supporting document for an exact assertion. Publication resolves the current
 * reviewed claim version, selector and assessed work lineage; a URL alone is discovery.
 */
export const storyAnchorSchema = z.object({
  claimId: z.string().min(1).optional(),
  claimVersionId: z.string().min(1).optional(),
  selectorId: z.string().min(1).optional(),
  url: z.string().url().max(2048),
  label: z.string().min(1).max(240),
});
export type StoryAnchorDoc = z.infer<typeof storyAnchorSchema>;

/* ------------------------------------------------------------------------- *
 * Body blocks — discriminated on `type`.
 * ------------------------------------------------------------------------- */

/** A heading within the body. `level` maps to <h2>/<h3>. */
const storyHeadingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().min(1).max(240),
});

/** A prose paragraph. `text` may embed `[ref:<id>]` inline-citation markers. */
const storyParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1),
});

/**
 * A block quotation, optionally attributed. Publication requires reviewed exact
 * evidence references. `replicationVerified` is retained for compatibility and
 * confers no acceptance authority; see reviewed-anchors.ts in ops-data.
 */
const storyPullQuoteBlockSchema = z.object({
  type: z.literal('pullquote'),
  text: z.string().min(1).max(600),
  attribution: z.string().min(1).max(240).optional(),
  anchors: z.array(storyAnchorSchema).optional(),
  replicationVerified: z.boolean().optional(),
});

/**
 * A metric figure rendered as a chart from a packet's cited observations. When
 * `metricIds` is omitted the renderer charts every time-series metric on the
 * packet; provide it to pin the figure to specific series.
 */
const storyFigureBlockSchema = z.object({
  type: z.literal('figure'),
  packetId: z.string().min(1),
  metricIds: z.array(z.string().min(1)).min(1).optional(),
  caption: z.string().min(1).max(400),
  anchors: z.array(storyAnchorSchema).optional(),
  replicationVerified: z.boolean().optional(),
});

/** A single-observation callout (rendered as a DataMoment). */
const storyStatBlockSchema = z.object({
  type: z.literal('stat'),
  packetId: z.string().min(1),
  kind: z.enum(['observation', 'derived']),
  refId: z.string().min(1),
  caption: z.string().min(1).max(400).optional(),
  anchors: z.array(storyAnchorSchema).optional(),
  replicationVerified: z.boolean().optional(),
});

/** A primary-document excerpt drawn from a packet artifact. */
const storyPrimaryDocumentBlockSchema = z.object({
  type: z.literal('primaryDocument'),
  packetId: z.string().min(1),
  refId: z.string().min(1),
  quote: z.string().min(1).max(1200).optional(),
});

/** A dated event timeline sourced from a packet's dated artifacts. */
const storyTimelineBlockSchema = z.object({
  type: z.literal('timeline'),
  packetId: z.string().min(1),
});

/** A single geo-anchored entity pinned on a small map inset. */
const storyMapInsetBlockSchema = z.object({
  type: z.literal('mapInset'),
  entityId: z.string().min(1),
  label: z.string().min(1).max(240).optional(),
});

/** A two-source dispute surfaced inline. */
const storyDisputeBlockSchema = z.object({
  type: z.literal('dispute'),
  label: z.string().min(1).max(240),
  sideA: z.object({ sourceLabel: z.string().min(1), claim: z.string().min(1) }),
  sideB: z.object({ sourceLabel: z.string().min(1), claim: z.string().min(1) }),
});

/** An inline image with a caption. */
const storyImageBlockSchema = z.object({
  type: z.literal('image'),
  image: storyImageSchema,
  caption: z.string().min(1).max(400).optional(),
});

/**
 * A list of short, individually-sourced points — the "call-outs" shape the record
 * stories are built from (one documented act per item, each carrying its own
 * `[ref:<id>]` markers). Items are prose strings, not nested blocks: a call-out that
 * needs a chart or a document excerpt is not a call-out, it is a section, and should be
 * authored as one. Citation integrity scans these items exactly like paragraph text.
 */
const storyListBlockSchema = z.object({
  type: z.literal('list'),
  style: z.enum(['bullet', 'number']).default('bullet'),
  items: z.array(z.string().min(1).max(600)).min(1).max(24),
});

export const storyBodyBlockSchema = z.discriminatedUnion('type', [
  storyHeadingBlockSchema,
  storyParagraphBlockSchema,
  storyListBlockSchema,
  storyPullQuoteBlockSchema,
  storyFigureBlockSchema,
  storyStatBlockSchema,
  storyPrimaryDocumentBlockSchema,
  storyTimelineBlockSchema,
  storyMapInsetBlockSchema,
  storyDisputeBlockSchema,
  storyImageBlockSchema,
]);
export type StoryBodyBlockDoc = z.infer<typeof storyBodyBlockSchema>;

/* ------------------------------------------------------------------------- *
 * Story projection.
 * ------------------------------------------------------------------------- */

/**
 * What editorial contract a story is published under. Both formats are stored in the same
 * table and rendered by the same body-block renderer; the format selects which gates apply
 * and how the piece is presented in the index.
 *
 * - `chapter` — the long-form era-immersion piece (`docs/content/neo-voice.md`).
 *   Uses reviewed evidence and editorial judgment to determine sufficient depth.
 * - `entry` — a short, structured record entry: a paragraph of context plus cited
 *   call-outs. Same evidence review, with no required length or era structure.
 *   Built for collections where the reader compares many entries against each other.
 *
 * Defaults to `chapter` so every story authored before this field existed keeps its
 * contract without being rewritten.
 */
export const storyFormatSchema = z.enum(['chapter', 'entry']);
export type StoryFormat = z.infer<typeof storyFormatSchema>;

/**
 * Membership in an ordered collection (the presidential records, for instance).
 * `position` is the collection's own ordering key — presidency number, not publication
 * date — so an index can present the collection in the order the subject actually runs in
 * rather than the order the entries happened to be written.
 */
export const storyCollectionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().min(1).max(120),
  position: z.number().int().min(0),
  /** Short label for this entry within the collection, e.g. "16th president". */
  positionLabel: z.string().min(1).max(80).optional(),
});
export type StoryCollectionDoc = z.infer<typeof storyCollectionSchema>;

/** Public credit snapshots contain no authentication or private contact information. */
export const storyContributorSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['person', 'editorial']),
  roles: z
    .array(z.enum(['author', 'researcher', 'editor']))
    .min(1)
    .max(3),
});
export type StoryContributorDoc = z.infer<typeof storyContributorSchema>;

export const publicStoryProjectionSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  format: storyFormatSchema.default('chapter'),
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(600),
  heroImage: storyImageSchema.optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  eraLabel: z.string().min(1).max(80),
  placeLabel: z.string().min(1).max(120),
  themeId: storyThemeIdSchema.optional(),
  collection: storyCollectionSchema.optional(),
  /** Free facet labels the index groups and filters on (era grouping, subject class). */
  tags: z.array(z.string().min(1).max(80)).max(12).default([]),
  body: z.array(storyBodyBlockSchema).min(1),
  references: z.array(storyReferenceSchema).default([]),
  relatedEntityIds: z.array(z.string().min(1)).default([]),
  contributors: z.array(storyContributorSchema).max(24).default([]),
});
export type PublicStoryProjectionDoc = z.infer<typeof publicStoryProjectionSchema>;

/** Thin list-item projection for the `/stories` index — no body or references. */
export const publicStoryListItemSchema = publicStoryProjectionSchema.omit({
  body: true,
  references: true,
  relatedEntityIds: true,
});
export type PublicStoryListItemDoc = z.infer<typeof publicStoryListItemSchema>;

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

export type StoryCitationIntegrityIssue =
  | { readonly kind: 'unknown_reference'; readonly refId: string }
  | { readonly kind: 'unused_reference'; readonly refId: string };

/**
 * Check that inline `[ref:<id>]` markers and the `references[]` list agree:
 * every marker resolves to a reference, and every authored reference is either
 * cited inline or attached to a data block (data-block provenance is folded in
 * by the renderer, so references backing figures/stats are considered used when
 * `dataBackedRefIds` includes them).
 */
export function collectStoryCitationIssues(
  story: Pick<PublicStoryProjectionDoc, 'body' | 'references'>,
  dataBackedRefIds: readonly string[] = [],
): readonly StoryCitationIntegrityIssue[] {
  const referenceIds = new Set(story.references.map((ref) => ref.id));
  const usedIds = new Set<string>(dataBackedRefIds);
  const issues: StoryCitationIntegrityIssue[] = [];

  for (const block of story.body) {
    // Every block that carries author-written prose is scanned. `list` items are prose
    // too: a call-out bullet is exactly where an uncited claim would otherwise hide.
    const texts =
      block.type === 'paragraph' || block.type === 'pullquote'
        ? [block.text]
        : block.type === 'list'
          ? block.items
          : [];
    for (const text of texts) {
      for (const refId of extractInlineCitationIds(text)) {
        usedIds.add(refId);
        if (!referenceIds.has(refId)) {
          issues.push({ kind: 'unknown_reference', refId });
        }
      }
    }
  }

  for (const ref of story.references) {
    if (!usedIds.has(ref.id)) {
      issues.push({ kind: 'unused_reference', refId: ref.id });
    }
  }

  return issues;
}

/** Throws when inline citations and references disagree. Promote-gate hook. */
export function assertStoryCitationIntegrity(
  story: Pick<PublicStoryProjectionDoc, 'body' | 'references'>,
  dataBackedRefIds: readonly string[] = [],
): void {
  const issues = collectStoryCitationIssues(story, dataBackedRefIds);
  if (issues.length === 0) return;
  const detail = issues
    .map((issue) =>
      issue.kind === 'unknown_reference'
        ? `inline [ref:${issue.refId}] has no matching reference`
        : `reference "${issue.refId}" is never cited`,
    )
    .join('; ');
  throw new Error(`story citation integrity failed: ${detail}`);
}
