/**
 * Vendored wire-contract type shapes for the Learn/More content surfaces (MOB-015).
 *
 * INTEGRATION GAP — same one MOB-009 documented in `src/data/contracts.ts`. `apps/mobile` ships
 * its own isolated npm lockfile with no `@repo` scope in `apps/mobile/node_modules`, so
 * `@repo/public-contracts` cannot be imported here today. Rather than inventing a shape, we
 * vendor the MINIMAL structural subset this feature needs, kept field-for-field identical to its
 * source of truth. When the workspace wiring is fixed (follow-up bead), delete this file and
 * import the real zod types instead.
 *
 * SOURCE OF TRUTH (do not drift from these):
 *   - ContentSectionV1 / ContentPageV1 → packages/public-contracts/src/v1/content.ts
 *   - CitationV1                        → packages/public-contracts/src/v1/citation.ts
 *   - MobileLegalVersions                → packages/domain/src/publication/mobile-bootstrap.ts
 *
 * We deliberately vendor TYPES only (no zod runtime — apps/mobile has no zod dependency and this
 * bead does not add one). Structural safety for hostile/malformed payloads is enforced by
 * hand-rolled defensive checks in `content-blocks.ts`, not by re-validating against a schema.
 */

/**
 * `contentSectionV1Schema` — a single body section of a content page. `heading` is optional;
 * `paragraphs` is a bounded array of non-empty strings (bound: max 200 items, each max 10_000
 * chars server-side — this client only needs to know it is an array of strings and defends its
 * own bounds independently, see content-blocks.ts).
 */
export interface ContentSectionV1 {
  readonly heading?: string;
  readonly paragraphs: readonly string[];
}

/**
 * `contentPageV1Schema` — the public supporting-content (Learn surface) page shape. Extracted
 * from `apps/web/src/data/stories-seed.ts`'s `StoryRecord`, the longform editorial article shape
 * backing `/stories`, `/history`, `/myths` on web. This is the ONLY allowlisted content-page wire
 * shape this renderer supports — no headings/callouts/tables/media block-type union exists in
 * production today, so this feature does not invent one for the page body.
 */
export interface ContentPageV1 {
  readonly slug: string;
  readonly title: string;
  readonly dek: string;
  readonly publishedAt: string;
  readonly eraLabel: string;
  readonly placeLabel: string;
  readonly body: readonly ContentSectionV1[];
  readonly relatedEntityIds: readonly string[];
  readonly relatedFactIds: readonly string[];
}

/**
 * `citationV1Schema` — the already-redacted public citation view (source/label/href/
 * withheldReason). Used here as OPTIONAL, LOCAL editorial metadata attached to a handful of
 * catalog entries (methodology, legal) that want to show "primary sources" — this is NOT a wire
 * field of `ContentPageV1` (which carries no citations today); it is this feature's own
 * `LearnContentEntry` wrapper (see `content-catalog.ts`) reusing the real, already-production
 * citation shape rather than inventing a new one.
 */
export interface CitationV1 {
  readonly source: string;
  readonly label: string;
  readonly href?: string;
  readonly withheldReason?: string;
}

/**
 * `MobileLegalVersions` — `Record<string, string>` mapping a legal-document key (e.g. "privacy",
 * "terms") to its current version identifier, carried on the FULL release manifest
 * (`MobileBootstrapManifest.legalVersions`), NOT on the `/v1/bootstrap` wire projection
 * (`BootstrapResponseV1`, see `src/data/contracts.ts`) — that projection only forwards
 * `apiVersion`/`minSupportedApiVersion`/`deprecationWindowDays`/`activeRelease`/
 * `searchIndexVersion`/`contentVersion` (packages/public-contracts/src/v1/bootstrap.ts). Because
 * no live endpoint exposes the fuller manifest to mobile today, `legal-version.ts` provides a
 * pure predicate against this type for forward-compatibility, and a SEPARATE, actually-wired
 * runtime check using the real `contentVersion`/`activeRelease.releaseId` fields the endpoint
 * already returns (see `legal-version.ts` doc comment for the split).
 */
export type MobileLegalVersions = Readonly<Record<string, string>>;
