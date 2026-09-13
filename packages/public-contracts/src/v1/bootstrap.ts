/**
 * Mobile cold-start bootstrap response.
 *
 * Unlike the other `v1/*` modules, this one has no single pre-existing named type in
 * `apps/web` to extract verbatim — no literal "bootstrap" endpoint exists yet (the repo's only
 * prior uses of the word "bootstrap" describe the pre-release-builder placeholder data era, e.g.
 * `apps/web/src/lib/public-data/map-projection.ts`'s "bootstrap-window stubs" comments, not an
 * API contract). This shape is composed from two already-accepted concepts rather than invented
 * net-new: the release/revision metadata every public response carries (`releaseId`/`generatedAt`,
 * matching `./revision.ts`'s `RevisionMetadataV1`; see `docs/decisions-carryover.md`, "Public
 * projection and immutable publication snapshots") and
 * the version-floor constants in `./version.ts` (`docs/decisions-carryover.md`, "ADR-021's two
 * invariants": app/API compatibility). It is what `apps/mobile` (MOB-009) reads once at launch to
 * know which release is active and what its own client version must satisfy.
 */
import { z } from 'zod';
import { idString } from '../internal/primitives.js';
import { revisionMetadataV1Schema } from './revision.js';

export const bootstrapResponseV1Schema = z.object({
  apiVersion: z.literal('v1'),
  minSupportedApiVersion: z.literal('v1'),
  deprecationWindowDays: z.number().int().min(0).max(3650),
  activeRelease: revisionMetadataV1Schema,
  /** Present once a release search index exists for the active release; absent on a
   * pre-search bootstrap window. */
  searchIndexVersion: idString(200).optional(),
  /** Present once static content (stories/methodology/etc — see `./content.ts`) is
   * release-versioned; absent otherwise. */
  contentVersion: idString(200).optional(),
});

export type BootstrapResponseV1 = z.infer<typeof bootstrapResponseV1Schema>;
