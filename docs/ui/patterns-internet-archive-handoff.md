# Internet Archive handoff

**Status:** binding for record pages (2026-09).  
**Code:** `apps/web/src/lib/geography/internet-archive-sources.ts`, `RecordArchiveSources.tsx`, `RecordArchiveContribution.tsx`, `components/room/Evidence.tsx`, `components/evidence/EvidenceCard.tsx`.
**Related:** [`patterns-visit-handoff.md`](./patterns-visit-handoff.md), [`../methodology/capture-and-aggregators.md`](../methodology/capture-and-aggregators.md).

---

## Intent

BlackStory preserves cited sources through outbound links and Wayback capture, and surfaces **already-cited** Internet Archive items on record pages. This is inbound reader UI only: no live IA search box on every record.

---

## Inbound (Phase D)

Published claim citations keep the original source in `citationHref`. When preservation has a
completed, exact-source, policy-eligible SPN2 result, publication adds `archivedUrl` and
`archivedAt`. These are additive fields, not replacements or aliases. The record source list
labels the archived and original links separately and shows the archive date.
The same `ArchivedSourceLinks` renderer is used by the room source list and the public claim card,
so the primary Place record surface and its source-list variants use the same labels and date.

The archive is selected only from the exact capture revisions accepted as supporting evidence for
that independently reviewed claim. If several reviewed revisions qualify, the newest eligible
archive timestamp wins. A newer capture of the same URL outside that review cannot supply the
link. Internet Archive fetches the remote page independently, so the capture date does not prove
byte equality between its snapshot and the locally reviewed capture.

Archive eligibility is resolved while building a release. Public web reads never join private
evidence storage and never derive an archive URL. A later revocation or preservation-decision
expiry removes the pointer on the next reviewed publication or correction. It does not rewrite an
already-published or signed release dynamically, and the interface must not imply immediate
deletion from Internet Archive.

`resolveInternetArchiveSources()` scans public claim `citationHref` values for:

| Pattern | Kind |
|---|---|
| `archive.org/details/{identifier}` | `details` |
| `web.archive.org/web/{timestamp}/{url}` | `wayback` |

`RecordArchiveSources` renders:

- **Archived copies** heading
- Linked titles from citation labels
- Mono detail line (`Internet Archive item` or `Wayback capture of …`)
- Compact contribution handoff link

### Surfaces

| Surface | Placement |
|---|---|
| `/entity/[id]` column | After "What the sources say" when IA links exist |
| Table of contents | "Archived copies" with count |

---

## Outbound (Phase E, minimal)

Full IA upload integration is operator-gated and deferred. Shipped now:

- `/methodology#internet-archive` explains capture + staged export posture
- `RecordArchiveContribution` links readers to that section
- Operator workflow remains CLI capture/export (`capture-backfill --wayback` for SPN2; see
  [`../research/research-operations.md`](../research/research-operations.md) capture-backfill)

Future work: `archive-export --entity-id` verb, IA identifier on evidence rows, curated collection uploads after rights review.

---

## Tests

| Module | File |
|---|---|
| URL parsing + claim scan | `internet-archive-sources.test.ts` |
