/**
 * Public citation shape for a claim (extracted from `apps/web/src/lib/evidence/types.ts`'s
 * `EvidenceCitationView` — the already-redacted public view, deliberately NOT
 * `EvidenceCitationInput`, whose `protectedReason` field is an internal-only redaction rationale
 * that must never reach a client).
 *
 * Public-safe by construction: this schema has no `protectedFromPublicLink` /
 * `protectedReason` field at all, so a canonical/internal object parsed through it has those
 * fields silently dropped (zod's default `strip` mode for `z.object`) — see
 * `citation.test.ts`'s "drops internal-only fields" case for the negative-snapshot proof.
 */
import { z } from 'zod';
import { httpUrl, nonEmptyText } from '../internal/primitives.js';

export const citationV1Schema = z
  .object({
    source: nonEmptyText(300),
    label: nonEmptyText(300),
    href: httpUrl(2000).optional(),
    /** Present only when the underlying source is withheld from public linking (e.g. protects a
     * living person or an internal-only capture). Human-readable; never the internal reason
     * verbatim — that redaction is the server's job, this schema only bounds shape. */
    withheldReason: z.string().max(500).optional(),
  });

export type CitationV1 = z.infer<typeof citationV1Schema>;
